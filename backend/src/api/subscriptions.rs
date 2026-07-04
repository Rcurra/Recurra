use alloy::primitives::Address;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{
    chain::AppState,
    errors::AppError,
    models::{CreateSubscriptionRequest, Subscription},
};

/// Optional `?subscriber=0x...` filter for `GET /subscriptions`.
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub subscriber: Option<String>,
}

/// `GET /subscriptions` — list subscriptions from the registry.
///
/// With no query params this returns every subscription. With
/// `?subscriber=0x...` it returns just that address's subscriptions (what the
/// dashboard uses).
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<Subscription>>, AppError> {
    let mut subs = state.fetch_all_subscriptions().await?;

    if let Some(raw) = query.subscriber {
        // Validate + normalise to checksummed form so string comparison is exact.
        let wanted = raw
            .parse::<Address>()
            .map_err(|_| AppError::BadRequest(format!("invalid subscriber address: {raw}")))?
            .to_checksum(None);
        subs.retain(|s| s.subscriber == wanted);
    }

    Ok(Json(subs))
}

/// `GET /subscriptions/{id}` — fetch one subscription, 404 if it doesn't exist.
pub async fn get_one(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<Json<Subscription>, AppError> {
    match state.fetch_subscription(id).await? {
        Some(sub) => Ok(Json(sub)),
        None => Err(AppError::NotFound(format!("subscription {id} not found"))),
    }
}

/// `POST /subscriptions` — blocked on contracts.
///
/// Per the README flow the on-chain `subscribe()` is signed by the user's
/// session key client-side; the backend's job here is registering that session
/// key with `PaymentExecutor.registerSessionKey` — which isn't implemented
/// on-chain yet. So this returns 501 rather than pretending to succeed.
pub async fn create(
    State(state): State<AppState>,
    Json(body): Json<CreateSubscriptionRequest>,
) -> Result<Json<Subscription>, AppError> {
    // Validate the addresses now so this is ready the moment the contract lands.
    body.subscriber
        .parse::<Address>()
        .map_err(|_| AppError::BadRequest(format!("invalid subscriber address: {}", body.subscriber)))?;
    body.session_key
        .parse::<Address>()
        .map_err(|_| AppError::BadRequest(format!("invalid session_key address: {}", body.session_key)))?;

    let _ = state;
    Err(AppError::NotImplemented(
        "create blocked on PaymentExecutor.registerSessionKey (not deployed)".into(),
    ))
}

/// `DELETE /subscriptions/{id}` — blocked on contracts.
///
/// Cancelling calls `SubscriptionRegistry.unsubscribe(id)`, which is still
/// `TODO` in the Solidity. Returns 501 until it exists.
pub async fn cancel(State(state): State<AppState>, Path(id): Path<u64>) -> Result<Json<()>, AppError> {
    let _ = (state, id);
    Err(AppError::NotImplemented(
        "cancel blocked on SubscriptionRegistry.unsubscribe (not implemented)".into(),
    ))
}
