use alloy::primitives::Address;
use axum::{
    Json,
    extract::{Query, State},
};
use serde::Deserialize;

use crate::{chain::AppState, errors::AppError, models::Payment};

/// Optional `?subscriber=0x...` filter for `GET /payments`, same pattern as
/// `GET /subscriptions`.
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub subscriber: Option<String>,
}

/// `GET /payments` — the `PaymentExecuted` history the frontend's Activity
/// screen reads (F5, backend M4). With no query params this returns every
/// payment ever fired; `?subscriber=0x...` narrows it to one subscriber's
/// charges. Returns `[]` (not an error) when no executor is configured — an
/// older env predating this feature, not a real failure.
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<Payment>>, AppError> {
    let subscriber = match query.subscriber {
        Some(raw) => Some(
            raw.parse::<Address>()
                .map_err(|_| AppError::BadRequest(format!("invalid subscriber address: {raw}")))?,
        ),
        None => None,
    };

    Ok(Json(state.fetch_payments(subscriber).await?))
}
