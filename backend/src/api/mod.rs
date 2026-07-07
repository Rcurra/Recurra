mod subscriptions;

use axum::{Router, routing::get};

use crate::chain::AppState;

pub fn router(state: AppState) -> Router {
    // v1 is a read-only index layer for the dashboard — every route is a GET.
    // Writes have exactly one path each by authority (user-signed via ZeroDev,
    // or protocol-signed via the scheduler), so the API accepts no writes.
    Router::new()
        // NOTE: axum 0.8 uses `{id}` capture syntax (the old `:id` form panics at startup).
        .route("/subscriptions", get(subscriptions::list))
        .route("/subscriptions/{id}", get(subscriptions::get_one))
        .route("/plans", get(subscriptions::list_plans))
        .route("/plans/{id}", get(subscriptions::get_plan))
        .with_state(state)
}
