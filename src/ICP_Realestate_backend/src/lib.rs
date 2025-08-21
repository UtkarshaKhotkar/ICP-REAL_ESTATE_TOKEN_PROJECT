use ic_cdk::api::{caller, id};
use ic_cdk::api::call::call;
use ic_cdk_macros::{init, update, query, pre_upgrade, post_upgrade};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --------- Data Models ---------
#[derive(Clone, Debug, CandidType, Serialize, Deserialize)]
pub struct Property {
    id: u64,
    name: String,
    description: String,
    thumbnail_url: String,
    price_per_share: u64,
    total_shares: u128,
    available_shares: u128,
    owners: HashMap<Principal, u128>, // (owner -> shares)
}

#[derive(Clone, Debug, CandidType, Serialize, Deserialize)]
pub struct PropertyView {
    id: u64,
    name: String,
    description: String,
    thumbnail_url: String,
    price_per_share: u64,
    total_shares: u128,
    available_shares: u128,
    owners: Vec<(Principal, u128)>,
}

#[derive(Clone, Debug, CandidType, Serialize, Deserialize)]
pub enum Error {
    NotAuthorized,
    NotEnoughShares,
    PropertyNotFound,
    AlreadyExists,
    TokenCanisterNotSet,
}

// --------- State ---------
#[derive(Clone, Default, CandidType, Serialize, Deserialize)]
pub struct State {
    pub properties: HashMap<u64, Property>,
    pub next_property_id: u64,
    pub token_canister_id: Option<Principal>,
    pub consumed_by_user: HashMap<Principal, u128>,
}

thread_local! {
    static STATE: std::cell::RefCell<State> = std::cell::RefCell::new(State::default());
}

// --------- Lifecycle ---------
#[init]
fn init() {
    ic_cdk::println!("Canister initialized ✅");
}

#[pre_upgrade]
fn pre_upgrade() {
    STATE.with(|st| {
        ic_cdk::storage::stable_save((st.borrow().clone(),))
            .expect("❌ Failed to save state");
    });
}

#[post_upgrade]
fn post_upgrade() {
    let (st,): (State,) =
        ic_cdk::storage::stable_restore().unwrap_or_default();
    STATE.with(|state| *state.borrow_mut() = st);
}

// --------- Updates ---------
#[update]
fn add_property(
    name: String,
    description: String,
    total_shares: u128,
    price_per_share: u64,
    thumbnail_url: String,
) -> Result<u64, Error> {
    STATE.with(|st| {
        let mut state = st.borrow_mut();
        let id = state.next_property_id;

        if state.properties.contains_key(&id) {
            return Err(Error::AlreadyExists);
        }

        let property = Property {
            id,
            name,
            description,
            thumbnail_url,
            price_per_share,
            total_shares,
            available_shares: total_shares,
            owners: HashMap::new(),
        };

        state.properties.insert(id, property);
        state.next_property_id += 1;
        Ok(id)
    })
}

// Helper type matching the PK_Token_backend Transaction Candid
#[derive(Clone, Debug, CandidType, Deserialize)]
struct TokenTransaction {
    to: Option<Principal>,
    from: Option<Principal>,
    timestamp: u64,
    tx_type: String,
    amount: u64,
}

async fn get_unconsumed_deposit_for_user(user: Principal) -> Result<u128, Error> {
    let token_id = STATE.with(|st| st.borrow().token_canister_id);
    let token_id = token_id.ok_or(Error::TokenCanisterNotSet)?;

    let this_canister = id();

    // Call token canister to fetch all transactions
    let (txs,): (Vec<TokenTransaction>,) = call(token_id, "get_all_transactions", ()).await
        .map_err(|_| Error::NotAuthorized)?;

    let mut total_incoming: u128 = 0;
    for tx in txs.into_iter() {
        if let (Some(f), Some(t)) = (tx.from, tx.to) {
            if f == user && t == this_canister && tx.tx_type == "send" {
                total_incoming = total_incoming.saturating_add(tx.amount as u128);
            }
        }
    }

    let already_consumed = STATE.with(|st| {
        let state = st.borrow();
        *state.consumed_by_user.get(&user).unwrap_or(&0u128)
    });

    Ok(total_incoming.saturating_sub(already_consumed))
}

#[update]
async fn buy_shares(property_id: u64, shares: u128) -> Result<u128, Error> {
    let caller = caller();
    // Check deposits made by user to this canister via PK token transfers
    let required_price: u128 = STATE.with(|st| {
        let state = st.borrow();
        let property = state.properties.get(&property_id).cloned();
        property.map(|p| (p.price_per_share as u128).saturating_mul(shares))
    }).ok_or(Error::PropertyNotFound)?;

    let available_deposit = get_unconsumed_deposit_for_user(caller).await?;
    if available_deposit < required_price {
        return Err(Error::NotEnoughShares);
    }

    STATE.with(|st| {
        let mut state = st.borrow_mut();
        let property = state.properties.get_mut(&property_id).ok_or(Error::PropertyNotFound)?;

        if shares > property.available_shares {
            return Err(Error::NotEnoughShares);
        }

        *property.owners.entry(caller).or_insert(0) += shares;
        property.available_shares -= shares;

        // Mark deposit as consumed
        let entry = state.consumed_by_user.entry(caller).or_insert(0);
        *entry = entry.saturating_add(required_price);

        Ok(shares)
    })
}

#[update]
fn transfer_shares(property_id: u64, to: Principal, shares: u128) -> Result<(), Error> {
    let caller = caller();
    STATE.with(|st| {
        let mut state = st.borrow_mut();
        let property = state.properties.get_mut(&property_id).ok_or(Error::PropertyNotFound)?;

        let caller_shares = property.owners.get_mut(&caller).ok_or(Error::NotAuthorized)?;
        if *caller_shares < shares {
            return Err(Error::NotEnoughShares);
        }

        *caller_shares -= shares;
        if *caller_shares == 0 {
            property.owners.remove(&caller);
        }

        *property.owners.entry(to).or_insert(0) += shares;
        Ok(())
    })
}

// --------- Queries ---------
#[query]
fn get_property(property_id: u64) -> Result<PropertyView, Error> {
    STATE.with(|st| {
        let state = st.borrow();
        let property = state.properties.get(&property_id).ok_or(Error::PropertyNotFound)?;

        Ok(PropertyView {
            id: property.id,
            name: property.name.clone(),
            description: property.description.clone(),
            thumbnail_url: property.thumbnail_url.clone(),
            price_per_share: property.price_per_share,
            total_shares: property.total_shares,
            available_shares: property.available_shares,
            owners: property.owners.iter().map(|(p, s)| (*p, *s)).collect(),
        })
    })
}

#[query]
fn list_properties() -> Vec<PropertyView> {
    STATE.with(|st| {
        let state = st.borrow();
        state.properties.values().map(|property| {
            PropertyView {
                id: property.id,
                name: property.name.clone(),
                description: property.description.clone(),
                thumbnail_url: property.thumbnail_url.clone(),
                price_per_share: property.price_per_share,
                total_shares: property.total_shares,
                available_shares: property.available_shares,
                owners: property.owners.iter().map(|(p, s)| (*p, *s)).collect(),
            }
        }).collect()
    })
}

// --------- Admin / Config ---------
#[update]
fn set_token_canister(token_canister: Principal) -> Result<(), Error> {
    STATE.with(|st| {
        let mut state = st.borrow_mut();
        state.token_canister_id = Some(token_canister);
    });
    Ok(())
}

// --------- Export Candid ---------
ic_cdk::export_candid!();
