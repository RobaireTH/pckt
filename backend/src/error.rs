use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("not found")]
    NotFound,
    #[error("invalid input: {0}")]
    BadRequest(String),
    #[error("upstream failure: {0}")]
    Upstream(String),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    error: &'a str,
    message: String,
}

impl ApiError {
    fn status_and_code(&self) -> (StatusCode, &'static str) {
        match self {
            Self::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            Self::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            Self::Upstream(_) => (StatusCode::BAD_GATEWAY, "upstream"),
            Self::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "database"),
            Self::Other(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = self.status_and_code();
        let body = ErrorBody {
            error: code,
            message: self.to_string(),
        };
        (status, Json(body)).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
