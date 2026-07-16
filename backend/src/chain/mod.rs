//! Chain access layer: a shared provider + read helpers over the contracts.
//!
//! `AppState` is the single handle both the REST API and the scheduler clone.
//! It owns a type-erased [`DynProvider`] (an HTTP JSON-RPC connection to
//! `ARBITRUM_RPC`), the parsed registry address, and an Openfort client for the
//! (still-blocked) write path.

pub mod bindings;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use alloy::eips::BlockNumberOrTag;
use alloy::network::EthereumWallet;
use alloy::primitives::{Address, TxHash, U256};
use alloy::providers::{DynProvider, Provider, ProviderBuilder};
use alloy::signers::local::PrivateKeySigner;
use chrono::{DateTime, Utc};

use crate::config::Config;
use crate::errors::AppError;
use crate::models::{Payment, Plan, Subscription};
use crate::openfort::OpenfortClient;
use crate::sender::TxSender;
use bindings::{PaymentExecutor, SubscriptionRegistry};

/// Shared, cheaply-cloneable application state.
///
/// `DynProvider` and `Arc<OpenfortClient>` are both clone-by-reference, so
/// cloning `AppState` per request / per scheduler tick is effectively free.
#[derive(Clone)]
pub struct AppState {
    /// Read-only HTTP JSON-RPC provider connected to `cfg.arbitrum_rpc`. Used
    /// for every view call, including simulating a charge before it's sent.
    pub provider: DynProvider,
    /// Parsed `SubscriptionRegistry` address (validated once at startup).
    pub registry: Address,
    /// Parsed `PaymentExecutor` address, if configured. `None` leaves the
    /// scheduler in log-only mode (it can read due subs but not fire them).
    pub executor: Option<Address>,
    /// Read once from the RPC at boot (never the hand-set env var — see
    /// `new()`). Used to pick a dedicated log-scanning RPC for `fetch_payments`
    /// on Arbitrum Sepolia specifically (see that method's doc comment).
    pub chain_id: u64,
    /// Signs and submits `executePayment`. Local wallet on anvil, Openfort on
    /// public networks — chosen once from config.
    pub sender: TxSender,
    /// Whether the scheduler is safe to run — false when `sender`'s address
    /// doesn't (or can't be proven to) match on-chain `authorizedExecutor` at
    /// boot. See the signer check in `AppState::new`. The read-only API boots
    /// either way; only `main.rs`'s scheduler spawn gates on this.
    pub scheduler_enabled: bool,
    /// Raw config, kept for the scheduler interval, vault address, etc.
    pub cfg: Config,
}

/// Result of comparing the configured signer against on-chain
/// `authorizedExecutor` — pulled out of `AppState::new` as a pure function so
/// the mismatch case is unit-testable without a live RPC (Track 1).
#[derive(Debug, PartialEq, Eq)]
enum SignerCheck {
    /// The configured signer is exactly the address the contract will accept.
    Match,
    /// The configured signer is known but doesn't match — every real
    /// `executePayment` this backend submits would revert `NotAuthorized`.
    Mismatch {
        configured: Address,
        onchain: Address,
    },
    /// No signer address could be derived to check against (Openfort path
    /// without `OPENFORT_WALLET_ADDRESS` set) — can't prove it's safe, so
    /// treated the same as a mismatch: refuse to start the scheduler.
    Unverifiable,
}

fn signer_check(derived_signer: Option<Address>, onchain_authorized: Address) -> SignerCheck {
    match derived_signer {
        Some(configured) if configured == onchain_authorized => SignerCheck::Match,
        Some(configured) => SignerCheck::Mismatch {
            configured,
            onchain: onchain_authorized,
        },
        None => SignerCheck::Unverifiable,
    }
}

impl AppState {
    /// Build the shared state from config, failing fast if the RPC URL, the
    /// registry/executor addresses or the local signer key are malformed, or if
    /// the RPC is unreachable (better a startup error than a confusing one on
    /// the first request/tick).
    pub async fn new(cfg: Config) -> Result<Self, AppError> {
        let url: reqwest::Url = cfg
            .arbitrum_rpc
            .parse()
            .map_err(|e| AppError::Internal(format!("invalid ARBITRUM_RPC url: {e}")))?;

        let provider = ProviderBuilder::new().connect_http(url.clone()).erased();

        let registry = cfg.registry_address.parse::<Address>().map_err(|e| {
            AppError::Internal(format!("invalid SUBSCRIPTION_REGISTRY_ADDRESS: {e}"))
        })?;

        // Optional: the read-only API boots without an executor; the scheduler
        // just can't fire until it's set.
        let executor = match &cfg.executor_address {
            Some(s) => Some(
                s.parse::<Address>()
                    .map_err(|e| AppError::Internal(format!("invalid EXECUTOR_ADDRESS: {e}")))?,
            ),
            None => None,
        };

        // Single source of truth for the tx payload — read from the RPC rather
        // than trusting a hand-set env var that could disagree with it.
        let chain_id = provider
            .get_chain_id()
            .await
            .map_err(|e| AppError::Chain(format!("failed to read chain id from RPC: {e}")))?;

        // Pick the signing backend: a local wallet key means the anvil/dev path
        // (sign in-process); otherwise route through the Openfort TEE.
        let (sender, derived_signer) = match &cfg.local_signer_key {
            Some(key) => {
                let signer: PrivateKeySigner = key.parse().map_err(|e| {
                    AppError::Internal(format!("invalid LOCAL_SIGNER_PRIVATE_KEY: {e}"))
                })?;
                let signer_addr = signer.address();
                let wallet = EthereumWallet::from(signer);
                let wallet_provider = ProviderBuilder::new()
                    .wallet(wallet)
                    .connect_http(url)
                    .erased();
                tracing::info!(signer = %signer_addr, "tx sender: local wallet (anvil/dev path)");
                (TxSender::Local(wallet_provider), Some(signer_addr))
            }
            None => {
                let openfort = Arc::new(OpenfortClient::new(
                    cfg.openfort_secret_key.clone(),
                    cfg.openfort_wallet_secret.clone().unwrap_or_default(),
                    cfg.openfort_publishable_key.clone(),
                ));
                tracing::info!("tx sender: Openfort hosted TEE");
                let wallet_addr = match &cfg.openfort_wallet_address {
                    Some(addr) => Some(addr.parse::<Address>().map_err(|e| {
                        AppError::Internal(format!("invalid OPENFORT_WALLET_ADDRESS: {e}"))
                    })?),
                    None => None,
                };
                if wallet_addr.is_some() && cfg.openfort_account_id.is_none() {
                    tracing::warn!(
                        "OPENFORT_WALLET_ADDRESS is set but OPENFORT_ACCOUNT_ID isn't — the \
                         Track 1 signer check can still pass, but every real submit will fail \
                         since the transaction-intents API needs the acc_... ID, not the address"
                    );
                }
                (
                    TxSender::Openfort {
                        client: openfort,
                        chain_id,
                        account_id: cfg.openfort_account_id.clone().unwrap_or_default(),
                    },
                    wallet_addr,
                )
            }
        };

        // Track 1 safety check: the scheduler always *simulates*
        // executePayment as the correct authorizedExecutor (see
        // scheduler/mod.rs), so a passing simulation can never reveal that our
        // real signer isn't that address — only a direct comparison can. A
        // `setAuthorizedExecutor` rotation nobody told this backend about
        // would otherwise turn into every real tx reverting NotAuthorized,
        // forever, silently. Refuse to start the scheduler rather than crash
        // the whole process — the read-only API doesn't depend on this at all.
        let scheduler_enabled = match executor {
            None => {
                tracing::warn!(
                    "EXECUTOR_ADDRESS unset — scheduler stays disabled (read-only mode)"
                );
                false
            }
            Some(executor_addr) => {
                let executor_contract = PaymentExecutor::new(executor_addr, &provider);
                match executor_contract.authorizedExecutor().call().await {
                    Ok(onchain_authorized) => {
                        match signer_check(derived_signer, onchain_authorized) {
                            SignerCheck::Match => {
                                tracing::info!(
                                    signer = %onchain_authorized,
                                    "signer matches on-chain authorizedExecutor — scheduler enabled"
                                );
                                true
                            }
                            SignerCheck::Mismatch {
                                configured,
                                onchain,
                            } => {
                                tracing::error!(
                                    configured = %configured,
                                    onchain = %onchain,
                                    "SIGNER MISMATCH: configured signer does not match on-chain \
                                     authorizedExecutor — every real executePayment would revert \
                                     NotAuthorized forever. Refusing to start the scheduler. Fix by \
                                     rotating the signer to match, or calling \
                                     PaymentExecutor.setAuthorizedExecutor to match this signer."
                                );
                                false
                            }
                            SignerCheck::Unverifiable => {
                                tracing::error!(
                                    onchain = %onchain_authorized,
                                    "cannot verify the Openfort signer against on-chain \
                                     authorizedExecutor (OPENFORT_WALLET_ADDRESS unset) — \
                                     refusing to start the scheduler until it's set"
                                );
                                false
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            error = %e,
                            "failed to read authorizedExecutor from chain at boot — \
                             refusing to start the scheduler"
                        );
                        false
                    }
                }
            }
        };

        if executor.is_some() && cfg.executor_deploy_block == 0 {
            tracing::warn!(
                "EXECUTOR_DEPLOY_BLOCK unset (defaulting to 0) — GET /api/payments will scan \
                 from the chain's genesis block, which can be slow or hit RPC log-range caps \
                 on a public network"
            );
        }

        Ok(Self {
            provider,
            registry,
            executor,
            chain_id,
            sender,
            scheduler_enabled,
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
            id, p.merchant, p.token, p.amount, p.interval, p.active,
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
            plans.push(map_plan(
                id, p.merchant, p.token, p.amount, p.interval, p.active,
            ));
        }
        Ok(plans)
    }

    /// Every `PaymentExecuted` event from `cfg.executor_deploy_block` forward,
    /// optionally filtered to one subscriber (topic2 — the event's second
    /// indexed field). Returns `[]` rather than erroring when no executor is
    /// configured, matching the scheduler's own log-only fallback.
    ///
    /// Scan-window strategy (Track 2): `.chunked()` attempts the full range in
    /// one `eth_getLogs` call first and only splits into smaller windows if
    /// that fails. That alone doesn't cover Arbitrum Sepolia's public
    /// publicnode.com endpoint though — found live standing this up: it
    /// rejects any wide historical `getLogs` outright ("Archive requests
    /// require a personal token"), no matter the window size, the exact thing
    /// the frontend's `lib/receipts.ts` already hit and fixed. Same fix here:
    /// route log scans (and the block-timestamp lookups they need) through
    /// Arbitrum's own official RPC, which has no such cap — used only for
    /// this method, not `self.provider`'s normal per-request calls, since
    /// switching those wholesale isn't necessary and this endpoint is better
    /// reserved for the occasional wide scan.
    ///
    /// A full deploy-block-to-tip scan on every request is fine at Sepolia's
    /// current history size; the natural ceiling is pagination or an indexer
    /// once the event count makes an unbounded scan slow — not needed for
    /// the hackathon.
    pub async fn fetch_payments(
        &self,
        subscriber: Option<Address>,
    ) -> Result<Vec<Payment>, AppError> {
        let Some(executor) = self.executor else {
            return Ok(Vec::new());
        };

        let logs_provider: DynProvider = if self.chain_id == 421_614 {
            let url: reqwest::Url = "https://sepolia-rollup.arbitrum.io/rpc"
                .parse()
                .expect("hardcoded URL is valid");
            ProviderBuilder::new().connect_http(url).erased()
        } else {
            self.provider.clone()
        };

        let executor_contract = PaymentExecutor::new(executor, &logs_provider);

        let mut event = executor_contract
            .PaymentExecuted_filter()
            .from_block(self.cfg.executor_deploy_block)
            .to_block(BlockNumberOrTag::Latest);
        if let Some(sub) = subscriber {
            event = event.topic2(sub);
        }

        let logs =
            event.chunked().query().await.map_err(|e| {
                AppError::Chain(format!("failed to scan PaymentExecuted logs: {e}"))
            })?;

        // Multiple payments can land in the same block; cache the lookup so a
        // busy block only costs one extra RPC round trip, not one per event.
        let mut block_timestamps: HashMap<u64, DateTime<Utc>> = HashMap::new();
        let mut payments = Vec::with_capacity(logs.len());

        for (decoded, log) in logs {
            let block_number = log.block_number.unwrap_or_default();
            let tx_hash = log
                .transaction_hash
                .map(|h| h.to_string())
                .unwrap_or_default();

            // Found live 2026-07-15: Arbitrum's own Sepolia RPC includes
            // `blockTimestamp` in getLogs responses but sets it to a literal
            // `0x0` rather than omitting the field — a real zero, not a
            // sentinel for "not provided". Treat it the same as absent
            // rather than trusting it, since 0 is never a genuine Sepolia
            // block timestamp.
            let timestamp = match log.block_timestamp {
                Some(ts) if ts != 0 => {
                    DateTime::from_timestamp(ts as i64, 0).unwrap_or_else(Utc::now)
                }
                _ => match block_timestamps.get(&block_number) {
                    Some(cached) => *cached,
                    None => {
                        let block = logs_provider
                            .get_block_by_number(BlockNumberOrTag::Number(block_number))
                            .await
                            .map_err(|e| {
                                AppError::Chain(format!(
                                    "failed to fetch block {block_number}: {e}"
                                ))
                            })?
                            .ok_or_else(|| {
                                AppError::Chain(format!("block {block_number} not found"))
                            })?;
                        let ts = DateTime::from_timestamp(block.header.timestamp as i64, 0)
                            .unwrap_or_else(Utc::now);
                        block_timestamps.insert(block_number, ts);
                        ts
                    }
                },
            };

            payments.push(map_payment(
                decoded.subId,
                decoded.subscriber,
                decoded.merchant,
                decoded.token,
                decoded.amount,
                tx_hash,
                block_number,
                timestamp,
            ));
        }

        payments.sort_by_key(|p| p.block_number);
        Ok(payments)
    }

    /// Wait for a submitted tx's receipt and confirm it actually succeeded
    /// on-chain — a passing `eth_call` simulation doesn't guarantee the
    /// broadcast tx lands the same way (race, reorg, gas griefing, or an
    /// `authorizedExecutor` rotation that happened after boot, which the
    /// Track 1 startup check can only catch once). Mirrors the frontend's
    /// `writeContractSafely`/`buildTxReceipt` retry: a hash can be briefly
    /// unknown to whichever RPC node it lands on right after broadcast.
    pub async fn wait_for_success(&self, tx_hash: &str) -> Result<(), AppError> {
        let hash: TxHash = tx_hash
            .parse()
            .map_err(|e| AppError::Internal(format!("invalid tx hash {tx_hash}: {e}")))?;

        const MAX_ATTEMPTS: u32 = 5;
        for attempt in 1..=MAX_ATTEMPTS {
            match self.provider.get_transaction_receipt(hash).await {
                Ok(Some(receipt)) if receipt.status() => return Ok(()),
                Ok(Some(_)) => {
                    return Err(AppError::Chain(format!(
                        "tx {tx_hash} reverted on-chain despite a passing simulation"
                    )));
                }
                Ok(None) | Err(_) if attempt < MAX_ATTEMPTS => {
                    tokio::time::sleep(Duration::from_millis(500 * attempt as u64)).await;
                }
                Ok(None) => {
                    return Err(AppError::Chain(format!(
                        "tx {tx_hash} not found after {MAX_ATTEMPTS} retries — cannot confirm it landed"
                    )));
                }
                Err(e) => {
                    return Err(AppError::Chain(format!(
                        "failed to fetch receipt for {tx_hash}: {e}"
                    )));
                }
            }
        }
        unreachable!("loop always returns within MAX_ATTEMPTS")
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
fn map_plan(
    id: u64,
    merchant: Address,
    token: Address,
    amount: U256,
    interval: U256,
    active: bool,
) -> Plan {
    Plan {
        id,
        merchant: merchant.to_checksum(None),
        token: token.to_checksum(None),
        amount: amount.to_string(),
        interval_secs: u64::try_from(interval).unwrap_or(0),
        active,
    }
}

/// Convert a decoded `PaymentExecuted` event + its log metadata into the
/// API's `Payment` model. Same precision/checksum rules as `map_plan`/
/// `map_subscription`: addresses checksummed, amount kept as a decimal
/// string so a 256-bit value never round-trips through a JSON number.
#[allow(clippy::too_many_arguments)]
fn map_payment(
    sub_id: U256,
    subscriber: Address,
    merchant: Address,
    token: Address,
    amount: U256,
    tx_hash: String,
    block_number: u64,
    timestamp: DateTime<Utc>,
) -> Payment {
    Payment {
        sub_id: u64::try_from(sub_id).unwrap_or(0),
        subscriber: subscriber.to_checksum(None),
        merchant: merchant.to_checksum(None),
        token: token.to_checksum(None),
        amount: amount.to_string(),
        tx_hash,
        block_number,
        timestamp,
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

        let plan = map_plan(1, merchant, token, amount, U256::from(2_592_000u64), true);

        assert_eq!(plan.id, 1);
        assert_eq!(plan.amount, "123456789012345678901234567890");
        assert_eq!(plan.interval_secs, 2_592_000);
        assert_eq!(plan.merchant, "0x0000000000000000000000000000000000000001");
        assert!(plan.active);
    }

    #[test]
    fn map_payment_keeps_full_precision_amount_and_checksums_addresses() {
        let amount = U256::from_str_radix("123456789012345678901234567890", 10).unwrap();
        let subscriber: Address = "0x52908400098527886e0f7030069857d2e4169ee7"
            .parse()
            .unwrap();
        let merchant: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        let token: Address = "0x0000000000000000000000000000000000000002"
            .parse()
            .unwrap();

        let payment = map_payment(
            U256::from(7u64),
            subscriber,
            merchant,
            token,
            amount,
            "0xabc".to_string(),
            287_458_282,
            DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
        );

        assert_eq!(payment.sub_id, 7);
        assert_eq!(
            payment.subscriber,
            "0x52908400098527886E0F7030069857D2E4169EE7"
        );
        assert_eq!(
            payment.merchant,
            "0x0000000000000000000000000000000000000001"
        );
        assert_eq!(payment.amount, "123456789012345678901234567890");
        assert_eq!(payment.tx_hash, "0xabc");
        assert_eq!(payment.block_number, 287_458_282);
        assert_eq!(payment.timestamp.timestamp(), 1_700_000_000);
    }

    // Track 1: the signer/authorizedExecutor mismatch case that should make
    // startup refuse to enable the scheduler.
    #[test]
    fn signer_check_flags_a_mismatched_signer() {
        let configured: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        let onchain: Address = "0x0000000000000000000000000000000000000002"
            .parse()
            .unwrap();

        match signer_check(Some(configured), onchain) {
            SignerCheck::Mismatch {
                configured: c,
                onchain: o,
            } => {
                assert_eq!(c, configured);
                assert_eq!(o, onchain);
            }
            other => panic!("expected Mismatch, got {other:?}"),
        }
    }

    #[test]
    fn signer_check_confirms_a_matching_signer() {
        let addr: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        assert_eq!(signer_check(Some(addr), addr), SignerCheck::Match);
    }

    #[test]
    fn signer_check_is_unverifiable_with_no_derivable_signer() {
        let onchain: Address = "0x0000000000000000000000000000000000000002"
            .parse()
            .unwrap();
        assert_eq!(signer_check(None, onchain), SignerCheck::Unverifiable);
    }
}
