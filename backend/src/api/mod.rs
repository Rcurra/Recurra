mod subscriptions;

use axum::{routing::get, Router};

use crate::chain::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        // NOTE: axum 0.8 uses `{id}` capture syntax (the old `:id` form panics at startup).
        .route(
            "/subscriptions",
            get(subscriptions::list).post(subscriptions::create),
        )
        .route(
            "/subscriptions/{id}",
            get(subscriptions::get_one).delete(subscriptions::cancel),
        )
        .with_state(state)
}
