mod subscriptions;

use axum::{routing::get, Router};

pub fn router() -> Router {
    Router::new()
        .route("/subscriptions", get(subscriptions::list).post(subscriptions::create))
        .route("/subscriptions/:id", get(subscriptions::get_one).delete(subscriptions::cancel))
}
