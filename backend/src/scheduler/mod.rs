use std::time::Duration;

use chrono::Utc;
use tokio::time;

use crate::chain::AppState;
use crate::errors::AppError;

// Wakes up every `cfg.scheduler_interval_secs` seconds, checks the registry for
// overdue subscriptions, and (once contracts land) fires payments through Openfort.
pub async fn run(state: AppState) {
    let mut ticker = time::interval(Duration::from_secs(state.cfg.scheduler_interval_secs));

    loop {
        ticker.tick().await;
        tracing::info!("scheduler tick — checking for due subscriptions");

        if let Err(e) = process_due_subscriptions(&state).await {
            tracing::error!("scheduler error: {e}");
        }
    }
}

async fn process_due_subscriptions(state: &AppState) -> Result<(), AppError> {
    // 1. Read all subscriptions, keep the active ones whose next payment is due.
    let now = Utc::now();
    let due: Vec<_> = state
        .fetch_all_subscriptions()
        .await?
        .into_iter()
        .filter(|s| s.active && s.next_payment_due <= now)
        .collect();

    if due.is_empty() {
        tracing::info!("no subscriptions due this tick");
        return Ok(());
    }

    tracing::info!(count = due.len(), "found due subscriptions");

    // 2. For each due subscription we would build calldata for
    //    PaymentExecutor.executePayment(subId) and submit it via
    //    state.openfort.send_transaction(...). Both are blocked until
    //    PaymentExecutor.executePayment exists on-chain and is bound in
    //    chain::bindings. A failure on one subscription must not abort the
    //    batch, so this loop will `continue` past per-payment errors then.
    for sub in due {
        tracing::info!(
            sub_id = sub.id,
            plan_id = sub.plan_id,
            subscriber = %sub.subscriber,
            due = %sub.next_payment_due,
            "subscription due for payment (execution blocked on PaymentExecutor)"
        );
    }

    Ok(())
}
