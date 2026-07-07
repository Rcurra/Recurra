use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub id: u64,
    pub merchant: String, // checksummed Ethereum address
    pub token: String,    // ERC-20 token address
    pub amount: String,   // token smallest-unit string, to avoid float precision loss
    pub interval_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: u64,
    pub plan_id: u64,
    pub subscriber: String,          // checksummed Ethereum address
    pub session_key: Option<String>, // always None: session keys live at the ZeroDev layer, never on-chain (M0)
    pub next_payment_due: DateTime<Utc>,
    pub active: bool,
}
