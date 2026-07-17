use axum::{Json, http::StatusCode, response::IntoResponse};
use serde_json::json;
use std::fmt;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    /// A failure talking to the chain: RPC transport error or a contract revert.
    /// Surfaced as 502 because the fault is an upstream dependency, not the request.
    Chain(String),
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::NotFound(msg) => write!(f, "not found: {msg}"),
            AppError::BadRequest(msg) => write!(f, "bad request: {msg}"),
            AppError::Chain(msg) => write!(f, "chain error: {msg}"),
            AppError::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        // NotFound/BadRequest describe the caller's own request — safe and
        // useful to echo back. Chain/Internal describe OUR side (raw RPC
        // transport errors can carry the provider URL, alloy internals, CLI
        // stderr) — that detail belongs in the server log, and the client
        // gets a generic line it can't mine for infrastructure details.
        let (status, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Chain(msg) => {
                tracing::error!(detail = %msg, "chain error while serving request");
                (
                    StatusCode::BAD_GATEWAY,
                    "upstream chain request failed".to_string(),
                )
            }
            AppError::Internal(msg) => {
                tracing::error!(detail = %msg, "internal error while serving request");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal error".to_string(),
                )
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

/// Any alloy contract call error (RPC transport failure, decode error, or an
/// on-chain revert) maps to `Chain`, so `?` works directly on `.call().await`.
impl From<alloy::contract::Error> for AppError {
    fn from(e: alloy::contract::Error) -> Self {
        AppError::Chain(e.to_string())
    }
}
