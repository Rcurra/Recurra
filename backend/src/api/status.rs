use axum::{Json, extract::State};

use crate::{chain::AppState, models::PaymentHealth};

/// `GET /status` — lets the dashboard (and the pre-subscribe confirmation)
/// warn users before they hit a silent failure, rather than after: when the
/// scheduler's real submits are currently blocked on a systemic cause (right
/// now, the Openfort operations-quota limit), `degraded` is true and
/// `message` is copy safe to render as-is.
pub async fn get(State(state): State<AppState>) -> Json<PaymentHealth> {
    Json(state.payment_health())
}
