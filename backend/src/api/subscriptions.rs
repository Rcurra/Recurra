use axum::{extract::Path, Json};

use crate::{errors::AppError, models::{CreateSubscriptionRequest, Subscription}};

pub async fn list() -> Result<Json<Vec<Subscription>>, AppError> {
    // TODO: query SubscriptionRegistry contract for active subscriptions
    Ok(Json(vec![]))
}

pub async fn create(
    Json(body): Json<CreateSubscriptionRequest>,
) -> Result<Json<Subscription>, AppError> {
    // TODO: call SubscriptionRegistry.subscribe on-chain, persist session key
    let _ = body;
    Err(AppError::Internal("not implemented".into()))
}

pub async fn get_one(Path(id): Path<u64>) -> Result<Json<Subscription>, AppError> {
    // TODO: fetch subscription by id from contract
    let _ = id;
    Err(AppError::NotFound(format!("subscription {id} not found")))
}

pub async fn cancel(Path(id): Path<u64>) -> Result<Json<()>, AppError> {
    // TODO: call SubscriptionRegistry.unsubscribe on-chain
    let _ = id;
    Err(AppError::Internal("not implemented".into()))
}
