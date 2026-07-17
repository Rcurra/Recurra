use alloy::primitives::Address;
use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;

use crate::{
    chain::AppState,
    errors::AppError,
    models::{Plan, Subscription},
};

/// Optional `?subscriber=0x...` filter for `GET /subscriptions`.
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub subscriber: Option<String>,
}

/// `GET /subscriptions` — list one subscriber's subscriptions.
///
/// `?subscriber=0x...` is required. The registry hands back that address's
/// exact id set in one call, so this stays O(k) in the caller's own subs.
/// The old unfiltered form walked every id ever issued — O(n) RPC calls
/// anyone could trigger with a bare curl — and no caller ever used it (the
/// dashboard always passes the filter), so it's a 400 now, not a slow
/// surprise.
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<Subscription>>, AppError> {
    let raw = query.subscriber.ok_or_else(|| {
        AppError::BadRequest("subscriber query parameter is required (?subscriber=0x...)".into())
    })?;
    let subscriber = raw
        .parse::<Address>()
        .map_err(|_| AppError::BadRequest(format!("invalid subscriber address: {raw}")))?;

    Ok(Json(state.fetch_subscriptions_for(subscriber).await?))
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

/// `GET /plans` — list every plan the registry has ever had.
pub async fn list_plans(State(state): State<AppState>) -> Result<Json<Vec<Plan>>, AppError> {
    Ok(Json(state.fetch_all_plans().await?))
}

/// `GET /plans/{id}` — fetch one plan, 404 if it doesn't exist.
pub async fn get_plan(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<Json<Plan>, AppError> {
    match state.fetch_plan(id).await? {
        Some(plan) => Ok(Json(plan)),
        None => Err(AppError::NotFound(format!("plan {id} not found"))),
    }
}

// NOTE: there is deliberately no `POST /subscriptions` or `DELETE
// /subscriptions/{id}`. Per the M0 freeze both writes are user-authority and
// signed client-side via ZeroDev (`subscribe`/`unsubscribe`): the backend has
// no key to sign as the user and no DB to book-keep, so a proxy endpoint would
// be a lie. The dashboard mutates by sending the user-signed tx itself and then
// re-reading these GETs. Protocol-authority writes (`executePayment`) go through
// the scheduler, never the API.
