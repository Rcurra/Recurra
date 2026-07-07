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

/// `GET /subscriptions` — list subscriptions from the registry.
///
/// With no query params this returns every subscription (walks all ids). With
/// `?subscriber=0x...` — what the dashboard uses — it asks the registry for that
/// address's id set directly, so the common path doesn't scan the whole registry.
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<Subscription>>, AppError> {
    let subs = match query.subscriber {
        Some(raw) => {
            let subscriber = raw
                .parse::<Address>()
                .map_err(|_| AppError::BadRequest(format!("invalid subscriber address: {raw}")))?;
            state.fetch_subscriptions_for(subscriber).await?
        }
        None => state.fetch_all_subscriptions().await?,
    };

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
