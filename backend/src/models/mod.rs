use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Constructed once plan endpoints (reading registry `plans()`) are added.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub id: u64,
    pub merchant: String,    // checksummed Ethereum address
    pub token: String,       // ERC-20 token address
    pub amount: String,      // wei string to avoid float precision loss
    pub interval_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: u64,
    pub plan_id: u64,
    pub subscriber: String,          // checksummed Ethereum address
    pub session_key: Option<String>, // ZeroDev session key; None until PaymentExecutor exposes it
    pub next_payment_due: DateTime<Utc>,
    pub active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateSubscriptionRequest {
    // Read by `create` once PaymentExecutor.registerSessionKey is wired.
    #[allow(dead_code)]
    pub plan_id: u64,
    pub subscriber: String,
    pub session_key: String,
}
