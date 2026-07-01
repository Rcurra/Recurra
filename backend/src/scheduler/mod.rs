use std::time::Duration;
use tokio::time;

use crate::config::Config;

// Wakes up every `cfg.scheduler_interval_secs` seconds, checks the registry
// for overdue subscriptions, and fires payments through Openfort.
pub async fn run(cfg: Config) {
    let mut ticker = time::interval(Duration::from_secs(cfg.scheduler_interval_secs));

    loop {
        ticker.tick().await;
        tracing::info!("scheduler tick — checking for due subscriptions");

        if let Err(e) = process_due_subscriptions(&cfg).await {
            tracing::error!("scheduler error: {e}");
        }
    }
}

async fn process_due_subscriptions(cfg: &Config) -> Result<(), crate::errors::AppError> {
    // TODO:
    // 1. Query cfg.registry_address for subscriptions where nextPaymentDue <= now
    // 2. For each: build calldata for PaymentExecutor.executePayment
    // 3. Call openfort::OpenfortClient::send_transaction
    // 4. Log the result
    let _ = cfg;
    Ok(())
}
