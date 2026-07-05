use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use std::fmt;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    /// A handler/path the backend deliberately doesn't serve yet (blocked on a
    /// contract that isn't deployed). Distinct from an unexpected internal error.
    NotImplemented(String),
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
            AppError::NotImplemented(msg) => write!(f, "not implemented: {msg}"),
            AppError::Chain(msg) => write!(f, "chain error: {msg}"),
            AppError::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::NotImplemented(msg) => (StatusCode::NOT_IMPLEMENTED, msg),
            AppError::Chain(msg) => (StatusCode::BAD_GATEWAY, msg),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
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
