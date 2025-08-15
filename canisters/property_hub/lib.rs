use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::caller;
use ic_cdk::storage;
use ic_cdk_macros::*;
use std::collections::{BTreeMap, BTreeSet};

type PropertyId = u64;
type ListingId = u64;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Property {
    pub id: PropertyId,
    pub title: String,
    pub description: String,
    pub metadata_uri: String, // link to docs, images, legal pack
    pub total_shares: Nat,
    pub circulating_shares: Nat,
    pub admin: Principal,     // property issuer/admin
    pub active: bool,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Listing {
    pub id: ListingId,
    pub seller: Principal,
    pub property_id: PropertyId,
    pub amount: Nat,
    pub price_per_share_e8s: u64, // demo: price units (think "cents"); replace with ICRC in prod
    pub active: bool,
}

#[derive(Default, CandidType, Deserialize)]
struct State {
    owner: Principal,
    next_property_id: PropertyId,
    next_listing_id: ListingId,

    // KYC allowlist
    kyc_ok: BTreeSet<Principal>,

    // Registry
    properties: BTreeMap<PropertyId, Property>,

    // Balances: (property_id, user) -> shares
    balances: BTreeMap<(PropertyId, Principal), Nat>,

    // Listings
    listings: BTreeMap<ListingId, Listing>,
    property_listings: BTreeMap<PropertyId, BTreeSet<ListingId>>,

    // Dividends: property -> total accrued; claims: (property, user) -> claimable
    dividends_total_e8s: BTreeMap<PropertyId, u128>,
    dividends_claimable_e8s: BTreeMap<(PropertyId, Principal), u128>,
}

thread_local! {
    static STATE: std::cell::RefCell<State> = std::cell::RefCell::new(State::default());
}

fn ensure_owner() {
    STATE.with(|s| {
        if s.borrow().owner != caller() {
            ic_cdk::trap("Only contract owner");
        }
    });
}

fn ensure_kyc(p: Principal) {
    STATE.with(|s| {
        if !s.borrow().kyc_ok.contains(&p) {
            ic_cdk::trap("KYC not satisfied for caller");
        }
    })
}

#[init]
fn init() {
    STATE.with(|s| s.borrow_mut().owner = caller());
}

#[query]
fn whoami() -> Principal { caller() }

#[update]
fn grant_kyc(user: Principal) {
    ensure_owner();
    STATE.with(|s| { s.borrow_mut().kyc_ok.insert(user); });
}

#[update]
fn revoke_kyc(user: Principal) {
    ensure_owner();
    STATE.with(|s| { s.borrow_mut().kyc_ok.remove(&user); });
}

#[update]
fn register_property(title: String, description: String, metadata_uri: String, total_shares: Nat) -> Property {
    ensure_owner(); // you can also make the issuer the caller and add per‑property admin sets
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let id = st.next_property_id; st.next_property_id += 1;
        let prop = Property {
            id,
            title,
            description,
            metadata_uri,
            total_shares: total_shares.clone(),
            circulating_shares: Nat::from(0u64),
            admin: caller(),
            active: true,
        };
        st.properties.insert(id, prop.clone());
        prop
    })
}

#[update]
fn mint_shares(property_id: PropertyId, to: Principal, amount: Nat) {
    // Only property admin (or owner) can mint, and not over total_shares
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let prop = st.properties.get_mut(&property_id).expect("Property not found");
        if !(prop.admin == caller() || st.owner == caller()) { ic_cdk::trap("Not property admin") }
        let new_circ = (&prop.circulating_shares + &amount);
        if new_circ > prop.total_shares { ic_cdk::trap("Exceeds total_shares cap") }
        prop.circulating_shares = new_circ;
        *st.balances.entry((property_id, to)).or_default() += amount;
    });
}

#[query]
fn get_property(property_id: PropertyId) -> Option<Property> {
    STATE.with(|s| s.borrow().properties.get(&property_id).cloned())
}

#[query]
fn list_properties(offset: u64, limit: u64) -> Vec<Property> {
    STATE.with(|s| {
        s.borrow().properties.values().skip(offset as usize).take(limit as usize).cloned().collect()
    })
}

#[query]
fn balance_of(user: Principal, property_id: PropertyId) -> Nat {
    STATE.with(|s| s.borrow().balances.get(&(property_id, user)).cloned().unwrap_or_else(|| Nat::from(0u64)))
}

#[update]
fn transfer_shares(property_id: PropertyId, to: Principal, amount: Nat) {
    ensure_kyc(caller());
    ensure_kyc(to);
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let from_key = (property_id, caller());
        let from_bal = st.balances.get_mut(&from_key).expect("No balance");
        if *from_bal < amount { ic_cdk::trap("Insufficient shares") }
        *from_bal -= amount.clone();
        *st.balances.entry((property_id, to)).or_default() += amount;
    });
}

#[update]
fn list_shares(property_id: PropertyId, amount: Nat, price_per_share_e8s: u64) -> Listing {
    ensure_kyc(caller());
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        // lock shares: deduct from balance until sold/cancelled
        let key = (property_id, caller());
        let bal = st.balances.get_mut(&key).expect("No balance");
        if *bal < amount { ic_cdk::trap("Insufficient shares to list") }
        *bal -= amount.clone();

        let id = st.next_listing_id; st.next_listing_id += 1;
        let listing = Listing { id, seller: caller(), property_id, amount, price_per_share_e8s, active: true };
        st.property_listings.entry(property_id).or_default().insert(id);
        st.listings.insert(id, listing.clone());
        listing
    })
}

#[update]
fn cancel_listing(listing_id: ListingId) {
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let l = st.listings.get_mut(&listing_id).expect("Listing not found");
        if l.seller != caller() { ic_cdk::trap("Only seller"); }
        if !l.active { ic_cdk::trap("Already inactive"); }
        l.active = false;
        *st.balances.entry((l.property_id, l.seller)).or_default() += l.amount.clone();
        if let Some(set) = st.property_listings.get_mut(&l.property_id) { set.remove(&listing_id); }
    })
}

#[query]
fn get_listings(property_id: PropertyId) -> Vec<Listing> {
    STATE.with(|s| {
        let st = s.borrow();
        st.property_listings
            .get(&property_id)
            .map(|ids| ids.iter().filter_map(|id| st.listings.get(id)).cloned().collect())
            .unwrap_or_default()
    })
}

#[update]
fn buy_listing(listing_id: ListingId, payment_e8s: u128) {
    // DEMO: "escrow" in canister accounting units (e8s). In prod, integrate ICRC‑1 ledger transfers.
    ensure_kyc(caller());
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let l = st.listings.get_mut(&listing_id).expect("Listing not found");
        if !l.active { ic_cdk::trap("Listing inactive"); }
        // check price
        // amount is Nat; convert to u128 for multiplication (bounded in demo)
        let amt_u128: u128 = l.amount.0.to_u128().expect("amount too big");
        let total = (l.price_per_share_e8s as u128) * amt_u128;
        if payment_e8s < total { ic_cdk::trap("Insufficient payment"); }

        l.active = false;
        // transfer shares to buyer
        *st.balances.entry((l.property_id, caller())).or_default() += l.amount.clone();

        // credit seller's "claimable dividends" bucket as sale proceeds (simplified)
        let key = (l.property_id, l.seller);
        *st.dividends_claimable_e8s.entry(key).or_default() += total;

        if let Some(set) = st.property_listings.get_mut(&l.property_id) { set.remove(&listing_id); }
    })
}

#[update]
fn accrue_dividends(property_id: PropertyId, total_dividend_e8s: u128) {
    // Only property admin funds dividends; distribution recorded as claimable per holder snapshot NOW
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let prop = st.properties.get(&property_id).expect("Property not found");
        if !(prop.admin == caller() || st.owner == caller()) { ic_cdk::trap("Not property admin"); }

        // build a snapshot of current holders for property_id
        let total_circ: u128 = prop.circulating_shares.0.to_u128().unwrap_or(0);
        if total_circ == 0 { ic_cdk::trap("No circulating shares"); }

        // walk balances and allocate
        for ((pid, user), bal) in st.balances.clone().into_iter() {
            if pid != property_id { continue; }
            let bal_u: u128 = bal.0.to_u128().unwrap_or(0);
            if bal_u == 0 { continue; }
            let share = (total_dividend_e8s * bal_u) / total_circ;
            *st.dividends_claimable_e8s.entry((property_id, user)).or_default() += share;
        }

        *st.dividends_total_e8s.entry(property_id).or_default() += total_dividend_e8s;
    })
}

#[query]
fn claimable_dividends(property_id: PropertyId, user: Principal) -> u128 {
    STATE.with(|s| *s.borrow().dividends_claimable_e8s.get(&(property_id, user)).unwrap_or(&0))
}

#[update]
fn claim_dividends(property_id: PropertyId) -> u128 {
    ensure_kyc(caller());
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let amt = st.dividends_claimable_e8s.remove(&(property_id, caller())).unwrap_or(0);
        // In prod, transfer via ICRC‑1 ledger to caller; here we just return the amount
        amt
    })
}

// --------- Stable upgrades ---------
#[pre_upgrade]
fn pre_upgrade() {
    let state: State = STATE.with(|s| s.borrow().clone());
    storage::stable_save((state,)).expect("stable save failed");
}
#[post_upgrade]
fn post_upgrade() {
    if let Ok((state,)) = storage::stable_restore::<(State,)>() {
        STATE.with(|s| *s.borrow_mut() = state);
    } else {
        init();
    }
}
