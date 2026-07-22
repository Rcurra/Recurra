use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub id: u64,
    pub merchant: String, // checksummed Ethereum address
    pub token: String,    // ERC-20 token address
    pub amount: String,   // token smallest-unit string, to avoid float precision loss
    pub interval_secs: u64,
    // Merchant-controlled kill switch (deactivatePlan). False means the
    // registry rejects new subscribe() calls for it — existing subscribers
    // are unaffected, but it should never appear as a *browsable* plan.
    pub active: bool,
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

/// Surfaced at `GET /status` so the dashboard (and the pre-subscribe
/// confirmation) can warn users *before* they hit a silent failure: when the
/// scheduler's last real submit failed on a recognized, systemic cause (the
/// Openfort operations-quota block hit live 2026-07-22), `degraded` flips on
/// and `message` carries copy safe to show directly — never the raw
/// CLI/RPC error text, which can carry account IDs or infra detail.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaymentHealth {
    pub degraded: bool,
    pub message: Option<String>,
    pub since: Option<DateTime<Utc>>,
}

/// One historical `PaymentExecuted` event — the record `GET /api/payments`
/// serves. Mirrors the frontend's `TxReceipt` shape closely enough that F5's
/// Activity screen can render it through the same `TxReceiptCard`/
/// `ReceiptListRow` components already built for wallet/vault receipts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub sub_id: u64,
    pub subscriber: String, // checksummed Ethereum address
    pub merchant: String,   // checksummed Ethereum address
    pub token: String,      // ERC-20 token address
    pub amount: String,     // token smallest-unit string, to avoid float precision loss
    pub tx_hash: String,
    pub block_number: u64,
    pub timestamp: DateTime<Utc>,
}
