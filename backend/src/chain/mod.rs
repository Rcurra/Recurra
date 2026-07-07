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
use crate::models::{Plan, Subscription};
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

        let registry = cfg.registry_address.parse::<Address>().map_err(|e| {
            AppError::Internal(format!("invalid SUBSCRIPTION_REGISTRY_ADDRESS: {e}"))
        })?;

        let openfort = Arc::new(OpenfortClient::new(cfg.openfort_secret_key.clone()));

        Ok(Self {
            provider,
            registry,
            openfort,
            cfg,
        })
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
        Ok(Some(map_subscription(
            id,
            s.planId,
            s.subscriber,
            s.nextPaymentDue,
            s.active,
        )))
    }

    /// Read every subscription the registry has ever issued.
    ///
    /// Subscription ids are dense and start at 1, so we read `nextSubId()` and
    /// walk `1..nextSubId`. Zeroed slots (shouldn't happen, but cheap to guard)
    /// are skipped. This is O(n) RPC calls; fine for a testnet/hackathon scale,
    /// and the natural replacement later is an event scan. Used by the unfiltered
    /// `GET /subscriptions`; the dashboard's per-subscriber view uses the far
    /// cheaper `fetch_subscriptions_for` instead.
    pub async fn fetch_all_subscriptions(&self) -> Result<Vec<Subscription>, AppError> {
        let registry = SubscriptionRegistry::new(self.registry, &self.provider);

        let next_sub_id: u64 = registry.nextSubId().call().await?.try_into().unwrap_or(0);

        let mut subs = Vec::new();
        for id in 1..next_sub_id {
            let s = registry.subscriptions(U256::from(id)).call().await?;
            if s.subscriber == Address::ZERO {
                continue;
            }
            subs.push(map_subscription(
                id,
                s.planId,
                s.subscriber,
                s.nextPaymentDue,
                s.active,
            ));
        }
        Ok(subs)
    }

    /// Read just one subscriber's subscriptions (active and cancelled — the list
    /// is append-only history). Uses the registry's `getSubscriberSubs` view to
    /// fetch the exact id set in one call, then reads each — O(k) in that
    /// subscriber's own subs rather than O(n) over every sub on-chain.
    pub async fn fetch_subscriptions_for(
        &self,
        subscriber: Address,
    ) -> Result<Vec<Subscription>, AppError> {
        let registry = SubscriptionRegistry::new(self.registry, &self.provider);

        let ids = registry.getSubscriberSubs(subscriber).call().await?;

        let mut subs = Vec::with_capacity(ids.len());
        for id in ids {
            let sub_id: u64 = id.try_into().unwrap_or(0);
            let s = registry.subscriptions(id).call().await?;
            if s.subscriber == Address::ZERO {
                continue;
            }
            subs.push(map_subscription(
                sub_id,
                s.planId,
                s.subscriber,
                s.nextPaymentDue,
                s.active,
            ));
        }
        Ok(subs)
    }

    /// Every subscription the registry currently considers due for payment.
    ///
    /// Due-ness is asked on-chain via `isDue(subId)` — the contract is the single
    /// source of truth, so there's no off-chain clock to drift. We only fetch the
    /// full struct for ids that come back due, so logging/execution has the
    /// subscriber + plan context it needs.
    pub async fn fetch_due_subscriptions(&self) -> Result<Vec<Subscription>, AppError> {
        let registry = SubscriptionRegistry::new(self.registry, &self.provider);

        let next_sub_id: u64 = registry.nextSubId().call().await?.try_into().unwrap_or(0);

        let mut due = Vec::new();
        for id in 1..next_sub_id {
            if !registry.isDue(U256::from(id)).call().await? {
                continue;
            }
            let s = registry.subscriptions(U256::from(id)).call().await?;
            due.push(map_subscription(
                id,
                s.planId,
                s.subscriber,
                s.nextPaymentDue,
                s.active,
            ));
        }
        Ok(due)
    }

    /// Read a single plan by id. `Ok(None)` when the id doesn't exist (unknown
    /// ids return a zeroed struct, so a zero-address merchant is the "not found"
    /// signal — the registry starts plan ids at 1 for exactly this reason).
    pub async fn fetch_plan(&self, id: u64) -> Result<Option<Plan>, AppError> {
        let registry = SubscriptionRegistry::new(self.registry, &self.provider);
        let p = registry.plans(U256::from(id)).call().await?;

        if p.merchant == Address::ZERO {
            return Ok(None);
        }
        Ok(Some(map_plan(
            id, p.merchant, p.token, p.amount, p.interval,
        )))
    }

    /// Read every plan ever created. Plan ids are dense from 1, so we read
    /// `nextPlanId()` and walk `1..nextPlanId`, skipping any zeroed slot.
    pub async fn fetch_all_plans(&self) -> Result<Vec<Plan>, AppError> {
        let registry = SubscriptionRegistry::new(self.registry, &self.provider);

        let next_plan_id: u64 = registry.nextPlanId().call().await?.try_into().unwrap_or(0);

        let mut plans = Vec::new();
        for id in 1..next_plan_id {
            let p = registry.plans(U256::from(id)).call().await?;
            if p.merchant == Address::ZERO {
                continue;
            }
            plans.push(map_plan(id, p.merchant, p.token, p.amount, p.interval));
        }
        Ok(plans)
    }
}

/// Convert on-chain primitives into the API's `Subscription` model.
///
/// - ids/plan ids are `uint256` on-chain but small in practice → `u64`
/// - `subscriber` is rendered as an EIP-55 checksummed string
/// - `nextPaymentDue` is a unix timestamp → `DateTime<Utc>`
/// - `session_key` is always `None`: per the M0 freeze, session keys are
///   validated entirely at the ZeroDev/Kernel account layer and never touch the
///   contracts, so there is nothing on-chain to surface here. The field is kept
///   for API-shape stability with the frontend.
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

/// Convert an on-chain `Plan` tuple into the API's `Plan` model.
///
/// - `merchant`/`token` are rendered as EIP-55 checksummed strings
/// - `amount` is a token-smallest-unit `uint256` → decimal string, so no
///   precision is lost squeezing it through a JSON number
/// - `interval` is seconds → `u64`
fn map_plan(id: u64, merchant: Address, token: Address, amount: U256, interval: U256) -> Plan {
    Plan {
        id,
        merchant: merchant.to_checksum(None),
        token: token.to_checksum(None),
        amount: amount.to_string(),
        interval_secs: u64::try_from(interval).unwrap_or(0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_subscription_checksums_address_and_converts_timestamp() {
        // lowercase in, EIP-55 checksummed out.
        let subscriber: Address = "0x52908400098527886e0f7030069857d2e4169ee7"
            .parse()
            .unwrap();
        let sub = map_subscription(
            7,
            U256::from(3),
            subscriber,
            U256::from(1_700_000_000u64),
            true,
        );

        assert_eq!(sub.id, 7);
        assert_eq!(sub.plan_id, 3);
        assert_eq!(sub.subscriber, "0x52908400098527886E0F7030069857D2E4169EE7");
        assert!(sub.session_key.is_none());
        assert_eq!(sub.next_payment_due.timestamp(), 1_700_000_000);
        assert!(sub.active);
    }

    #[test]
    fn map_plan_keeps_full_precision_amount_as_string() {
        // A 256-bit amount that would lose precision as an f64/JSON number.
        let amount = U256::from_str_radix("123456789012345678901234567890", 10).unwrap();
        let merchant: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        let token: Address = "0x0000000000000000000000000000000000000002"
            .parse()
            .unwrap();

        let plan = map_plan(1, merchant, token, amount, U256::from(2_592_000u64));

        assert_eq!(plan.id, 1);
        assert_eq!(plan.amount, "123456789012345678901234567890");
        assert_eq!(plan.interval_secs, 2_592_000);
        assert_eq!(plan.merchant, "0x0000000000000000000000000000000000000001");
    }
}
