//! Chain access layer: a shared provider + read helpers over the contracts.
//!
//! `AppState` is the single handle both the REST API and the scheduler clone.
//! It owns a type-erased [`DynProvider`] (an HTTP JSON-RPC connection to
//! `ARBITRUM_RPC`), the parsed registry address, and an Openfort client for the
//! (still-blocked) write path.

pub mod bindings;

use std::sync::Arc;

use alloy::primitives::{Address, U256};
use alloy::providers::{DynProvider, Provider, ProviderBuilder};
use chrono::{DateTime, Utc};

use crate::config::Config;
use crate::errors::AppError;
use crate::models::Subscription;
use crate::openfort::OpenfortClient;
use bindings::SubscriptionRegistry;

/// Shared, cheaply-cloneable application state.
///
/// `DynProvider` and `Arc<OpenfortClient>` are both clone-by-reference, so
/// cloning `AppState` per request / per scheduler tick is effectively free.
#[derive(Clone)]
pub struct AppState {
    /// HTTP JSON-RPC provider connected to `cfg.arbitrum_rpc`.
    pub provider: DynProvider,
    /// Parsed `SubscriptionRegistry` address (validated once at startup).
    pub registry: Address,
    /// TEE signer for server-side writes. Held ready; the payment path that
    /// uses it is blocked on `PaymentExecutor.executePayment` landing on-chain.
    #[allow(dead_code)]
    pub openfort: Arc<OpenfortClient>,
    /// Raw config, kept for the scheduler interval, chain id, vault address, etc.
    pub cfg: Config,
}

impl AppState {
    /// Build the shared state from config, failing fast if the RPC URL or the
    /// registry address are malformed (better a startup panic than a confusing
    /// error on the first request).
    pub fn new(cfg: Config) -> Result<Self, AppError> {
        let url = cfg
            .arbitrum_rpc
            .parse()
            .map_err(|e| AppError::Internal(format!("invalid ARBITRUM_RPC url: {e}")))?;

        let provider = ProviderBuilder::new().connect_http(url).erased();

        let registry = cfg
            .registry_address
            .parse::<Address>()
            .map_err(|e| AppError::Internal(format!("invalid SUBSCRIPTION_REGISTRY_ADDRESS: {e}")))?;

        let openfort = Arc::new(OpenfortClient::new(cfg.openfort_secret_key.clone()));

        Ok(Self { provider, registry, openfort, cfg })
    }

    /// Read a single subscription by id. Returns `Ok(None)` when the id doesn't
    /// exist on-chain (the registry returns a zeroed struct for unknown ids, so
    /// a zero-address subscriber is the "not found" signal).
    pub async fn fetch_subscription(&self, id: u64) -> Result<Option<Subscription>, AppError> {
        let registry = SubscriptionRegistry::new(self.registry, &self.provider);
        let s = registry.subscriptions(U256::from(id)).call().await?;

        if s.subscriber == Address::ZERO {
            return Ok(None);
        }
        Ok(Some(map_subscription(id, s.planId, s.subscriber, s.nextPaymentDue, s.active)))
    }

    /// Read every subscription the registry has ever issued.
    ///
    /// Subscription ids are dense and start at 1, so we read `nextSubId()` and
    /// walk `1..nextSubId`. Zeroed slots (shouldn't happen, but cheap to guard)
    /// are skipped. This is O(n) RPC calls; fine for a testnet/hackathon scale,
    /// and the natural replacement later is a contract-side "list due" view
    /// helper or an event scan.
    pub async fn fetch_all_subscriptions(&self) -> Result<Vec<Subscription>, AppError> {
        let registry = SubscriptionRegistry::new(self.registry, &self.provider);

        let next_sub_id: u64 = registry.nextSubId().call().await?.try_into().unwrap_or(0);

        let mut subs = Vec::new();
        for id in 1..next_sub_id {
            let s = registry.subscriptions(U256::from(id)).call().await?;
            if s.subscriber == Address::ZERO {
                continue;
            }
            subs.push(map_subscription(id, s.planId, s.subscriber, s.nextPaymentDue, s.active));
        }
        Ok(subs)
    }
}

/// Convert on-chain primitives into the API's `Subscription` model.
///
/// - ids/plan ids are `uint256` on-chain but small in practice → `u64`
/// - `subscriber` is rendered as an EIP-55 checksummed string
/// - `nextPaymentDue` is a unix timestamp → `DateTime<Utc>`
/// - `session_key` lives in `PaymentExecutor`, not the registry, so it's `None`
///   here until that contract (and its binding) exist.
fn map_subscription(
    id: u64,
    plan_id: U256,
    subscriber: Address,
    next_payment_due: U256,
    active: bool,
) -> Subscription {
    let due_secs = u64::try_from(next_payment_due).unwrap_or(0) as i64;
    Subscription {
        id,
        plan_id: u64::try_from(plan_id).unwrap_or(0),
        subscriber: subscriber.to_checksum(None),
        session_key: None,
        next_payment_due: DateTime::from_timestamp(due_secs, 0).unwrap_or_else(Utc::now),
        active,
    }
}
