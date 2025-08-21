use std::cell::RefCell;
use std::collections::HashMap;
use ic_cdk::api::{caller, time};
use candid::{Principal, CandidType, Deserialize};

// Persistent storage for balances: Principal => balance
thread_local! {
    static BALANCES: RefCell<HashMap<Principal, u64>> = RefCell::new(HashMap::new());
    static TOTAL_SUPPLY: RefCell<u64> = RefCell::new(0);
    static TRANSACTIONS: RefCell<Vec<Transaction>> = RefCell::new(Vec::new());
}

#[ic_cdk::query]
fn whoami() -> Principal {
    ic_cdk::caller()
}

// Transaction struct
#[derive(Clone, CandidType, Deserialize)]
pub struct Transaction {
    pub from: Option<Principal>,
    pub to: Option<Principal>,
    pub amount: u64,
    pub tx_type: String,
    pub timestamp: u64,
}

// Error enum
#[derive(CandidType, Deserialize)]
pub enum TokenError {
    InsufficientBalance,
    InvalidAmount,
    Unauthorized,
    Other(String),
}

// Result type
pub type TokenResult<T> = Result<T, TokenError>;

#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

// Mine PK Tokens for the caller
#[ic_cdk::update]
fn mine_tokens(amount: u64) -> TokenResult<String> {
    if amount == 0 {
        return Err(TokenError::InvalidAmount);
    }
    let user = caller();
    BALANCES.with(|cell| {
        let mut balances = cell.borrow_mut();
        let balance = balances.entry(user).or_insert(0);
        *balance += amount;
    });
    TOTAL_SUPPLY.with(|cell| {
        *cell.borrow_mut() += amount;
    });
    TRANSACTIONS.with(|cell| {
        cell.borrow_mut().push(Transaction {
            from: None,
            to: Some(user),
            amount,
            tx_type: "mine".to_string(),
            timestamp: time(),
        });
    });
    Ok(format!("Mined {} PK Tokens.", amount))
}

// Send PK Tokens from caller to receiver
#[ic_cdk::update]
fn send_tokens(receiver: Principal, amount: u64) -> TokenResult<String> {
    if amount == 0 {
        return Err(TokenError::InvalidAmount);
    }
    let sender = caller();
    let mut insufficient = false;
    BALANCES.with(|cell| {
        let mut balances = cell.borrow_mut();
        let sender_balance = balances.entry(sender).or_insert(0);
        if *sender_balance < amount {
            insufficient = true;
            return;
        }
        *sender_balance -= amount;
        let receiver_balance = balances.entry(receiver).or_insert(0);
        *receiver_balance += amount;
    });
    if insufficient {
        return Err(TokenError::InsufficientBalance);
    }
    TRANSACTIONS.with(|cell| {
        cell.borrow_mut().push(Transaction {
            from: Some(sender),
            to: Some(receiver),
            amount,
            tx_type: "send".to_string(),
            timestamp: time(),
        });
    });
    Ok(format!("Sent {} PK Tokens to {}.", amount, receiver.to_text()))
}

// Sell PK Tokens (burn from caller's balance)
#[ic_cdk::update]
fn sell_tokens(amount: u64) -> TokenResult<String> {
    if amount == 0 {
        return Err(TokenError::InvalidAmount);
    }
    let user = caller();
    let mut insufficient = false;
    BALANCES.with(|cell| {
        let mut balances = cell.borrow_mut();
        let balance = balances.entry(user).or_insert(0);
        if *balance < amount {
            insufficient = true;
            return;
        }
        *balance -= amount;
    });
    if insufficient {
        return Err(TokenError::InsufficientBalance);
    }
    TOTAL_SUPPLY.with(|cell| {
        *cell.borrow_mut() -= amount;
    });
    TRANSACTIONS.with(|cell| {
        cell.borrow_mut().push(Transaction {
            from: Some(user),
            to: None,
            amount,
            tx_type: "sell".to_string(),
            timestamp: time(),
        });
    });
    Ok(format!("Sold {} PK Tokens.", amount))
}

// Query caller's balance
#[ic_cdk::query]
fn get_my_balance() -> u64 {
    let user = caller();
    BALANCES.with(|cell| {
        let balances = cell.borrow();
        *balances.get(&user).unwrap_or(&0)
    })
}

// Query any user's balance (by principal)
#[ic_cdk::query]
fn get_balance_of(user: Principal) -> u64 {
    BALANCES.with(|cell| {
        let balances = cell.borrow();
        *balances.get(&user).unwrap_or(&0)
    })
}

// Query total supply
#[ic_cdk::query]
fn get_total_supply() -> u64 {
    TOTAL_SUPPLY.with(|cell| *cell.borrow())
}

// Query transaction history for caller
#[ic_cdk::query]
fn get_my_transactions() -> Vec<Transaction> {
    let user = caller();
    TRANSACTIONS.with(|cell| {
        cell.borrow()
            .iter()
            .filter(|tx| tx.from == Some(user) || tx.to == Some(user))
            .cloned()
            .collect()
    })
}

// Query all transactions (admin/debug)
#[ic_cdk::query]
fn get_all_transactions() -> Vec<Transaction> {
    TRANSACTIONS.with(|cell| cell.borrow().clone())
}

// Get caller's principal as text
#[ic_cdk::query]
fn get_my_principal() -> String {
    ic_cdk::api::caller().to_text()
}

ic_cdk::export_candid!();