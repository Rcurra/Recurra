use std::collections::HashMap;
use std::time::{Duration, Instant};

use alloy::primitives::U256;
use tokio::time;

use crate::chain::AppState;
use crate::chain::bindings::PaymentExecutor;
use crate::errors::AppError;
use crate::models::Subscription;

/// Longest gap between retries once a subscription's submit keeps failing
/// (e.g. an exhausted Openfort operations quota, seen live 2026-07-22: the
/// same due sub got resubmitted every 60s tick for 15+ minutes straight,
/// each attempt 402ing). Long enough to stop spamming the provider once a
/// tick's failure looks systemic; short enough that service resumes within
/// the hour once the underlying issue (e.g. adding a payment method) clears.
const MAX_BACKOFF_SECS: u64 = 1800;

/// Per-subscription record of consecutive submit failures, so a doomed
/// resubmit isn't retried every single tick. Keyed by subscription id;
/// cleared on a successful submit. Lives for the lifetime of one `run` loop
/// (or one test), not persisted across restarts — a fresh process is
/// entitled to try again immediately rather than inherit a stale backoff.
#[derive(Default)]
pub struct SubmitBackoff(HashMap<u64, BackoffEntry>);

struct BackoffEntry {
    consecutive_failures: u32,
    retry_after: Instant,
}

impl SubmitBackoff {
    fn should_skip(&self, sub_id: u64) -> bool {
        self.0
            .get(&sub_id)
            .is_some_and(|e| Instant::now() < e.retry_after)
    }

    fn record_failure(&mut self, sub_id: u64, base_interval: Duration) {
        let entry = self.0.entry(sub_id).or_insert(BackoffEntry {
            consecutive_failures: 0,
            retry_after: Instant::now(),
        });
        entry.consecutive_failures += 1;
        // Doubles each failure (interval, 2x, 4x, ...), capped — the cap is
        // what turns "retry forever every tick" into "retry occasionally".
        let backoff_secs = base_interval
            .as_secs()
            .saturating_mul(1u64 << entry.consecutive_failures.min(10))
            .min(MAX_BACKOFF_SECS);
        entry.retry_after = Instant::now() + Duration::from_secs(backoff_secs);
    }

    fn record_success(&mut self, sub_id: u64) {
        self.0.remove(&sub_id);
    }
}

// Wakes up every `cfg.scheduler_interval_secs` seconds, checks the registry for
// overdue subscriptions, and (once contracts land) fires payments through Openfort.
pub async fn run(state: AppState) {
    let mut ticker = time::interval(Duration::from_secs(state.cfg.scheduler_interval_secs));
    let mut backoff = SubmitBackoff::default();

    loop {
        ticker.tick().await;
        tracing::info!("scheduler tick — checking for due subscriptions");

        if let Err(e) = process_due_subscriptions(&state, &mut backoff).await {
            tracing::error!("scheduler error: {e}");
        }
    }
}

async fn process_due_subscriptions(
    state: &AppState,
    backoff: &mut SubmitBackoff,
) -> Result<(), AppError> {
    // 1. Ask the registry which subscriptions are due. Due-ness is decided
    //    on-chain via `isDue(subId)` (single source of truth) rather than an
    //    off-chain timestamp compare, so scheduler clock drift can never make us
    //    charge early or miss a cycle.
    let due = state.fetch_due_subscriptions().await?;

    if due.is_empty() {
        tracing::info!("no subscriptions due this tick");
        return Ok(());
    }

    tracing::info!(count = due.len(), "found due subscriptions");

    process_subscriptions(state, due, backoff).await
}

/// The per-subscription triage-and-fire loop, split from the due-list fetch
/// above so the anvil-backed integration test (`tests/scheduler_triage.rs`)
/// can replay a STALE due list against chain state that changed after the
/// fetch. That's not test-only contrivance — it's exactly the shape of the
/// races these branches exist for (`NotDue` / `SubscriptionInactive` /
/// `InsufficientVaultBalance` at simulate time all mean "the chain moved
/// between our read and our act"), just made deterministic. `run` always
/// calls this with a fresh fetch; the tick's behavior is unchanged.
pub async fn process_subscriptions(
    state: &AppState,
    due: Vec<Subscription>,
    backoff: &mut SubmitBackoff,
) -> Result<(), AppError> {
    // Without an executor address we can't fire — stay in log-only mode rather
    // than erroring every tick.
    let Some(executor) = state.executor else {
        tracing::warn!(
            count = due.len(),
            "subscriptions are due but EXECUTOR_ADDRESS is unset — cannot fire; \
             set it to enable the payment path"
        );
        return Ok(());
    };

    let executor_contract = PaymentExecutor::new(executor, &state.provider);

    // The address executePayment must be called from. We simulate as this
    // address so the caller check passes and the *business* reverts (due-ness,
    // active, balance) are what surface. Read from chain rather than assumed.
    let authorized = executor_contract.authorizedExecutor().call().await?;

    // 2. For each due sub: simulate the charge, triage any revert, and only
    //    submit a real tx when it would succeed. A per-sub failure `continue`s
    //    past — one bad sub must never abort the batch.
    for sub in due {
        // A sub whose last submit failed (e.g. Openfort quota 402) sits out
        // until its backoff window elapses — otherwise this loop resubmits
        // the same doomed tx every tick, forever, at whatever rate the
        // provider is already rejecting it.
        if backoff.should_skip(sub.id) {
            tracing::info!(sub_id = sub.id, "skip: backing off after submit failures");
            continue;
        }

        let sub_id = U256::from(sub.id);
        let call = executor_contract.executePayment(sub_id).from(authorized);

        // Simulate first. executePayment re-derives everything from chain state,
        // so a passing eth_call means the real tx will move money.
        if let Err(e) = call.call().await {
            match e.as_decoded_interface_error::<PaymentExecutor::PaymentExecutorErrors>() {
                // The scheduler's own idempotency: a racing tick (or a charge
                // already made this cycle) reverts NotDue. Expected, not an error.
                Some(PaymentExecutor::PaymentExecutorErrors::NotDue(_)) => {
                    tracing::info!(sub_id = sub.id, "skip: not due (benign race)");
                }
                Some(PaymentExecutor::PaymentExecutorErrors::SubscriptionInactive(_)) => {
                    tracing::info!(sub_id = sub.id, "skip: subscription or plan inactive");
                }
                Some(PaymentExecutor::PaymentExecutorErrors::InsufficientVaultBalance(_)) => {
                    tracing::warn!(
                        sub_id = sub.id,
                        subscriber = %sub.subscriber,
                        "skip: escrow can't cover the plan amount"
                    );
                }
                // NotAuthorized isn't per-sub — our signer isn't the executor's
                // authorizedExecutor, so every sub this batch will fail the same
                // way. Stop rather than spam.
                Some(PaymentExecutor::PaymentExecutorErrors::NotAuthorized(_)) => {
                    tracing::error!(
                        %authorized,
                        "executor rejects our signer (NotAuthorized) — check the \
                         signer matches authorizedExecutor; aborting batch"
                    );
                    break;
                }
                Some(PaymentExecutor::PaymentExecutorErrors::ZeroAddress(_)) => {
                    tracing::error!(sub_id = sub.id, "unexpected ZeroAddress revert");
                }
                None => {
                    tracing::error!(sub_id = sub.id, error = %e, "simulation failed");
                }
            }
            continue;
        }

        // Simulation passed — submit the real, signed tx via the configured
        // sender (local wallet on anvil, Openfort on public networks).
        let calldata = call.calldata().clone();
        match state.sender.send(executor, calldata).await {
            Ok(tx_hash) => {
                backoff.record_success(sub.id);
                state.record_payment_success();
                tracing::info!(
                    sub_id = sub.id,
                    plan_id = sub.plan_id,
                    subscriber = %sub.subscriber,
                    %tx_hash,
                    "fired executePayment"
                );
                // A passing simulation doesn't guarantee the broadcast tx lands
                // the same way (race, reorg, gas griefing, or authorizedExecutor
                // rotating out from under us mid-run) — confirm the receipt
                // actually succeeded instead of trusting the submit alone.
                if let Err(e) = state.wait_for_success(&tx_hash).await {
                    tracing::error!(
                        sub_id = sub.id,
                        %tx_hash,
                        error = %e,
                        "submitted tx did not confirm as successful"
                    );
                }
            }
            Err(e) => {
                backoff.record_failure(
                    sub.id,
                    Duration::from_secs(state.cfg.scheduler_interval_secs),
                );
                state.record_payment_failure(&e.to_string());
                tracing::error!(sub_id = sub.id, error = %e, "submit failed");
            }
        }
    }

    Ok(())
}
