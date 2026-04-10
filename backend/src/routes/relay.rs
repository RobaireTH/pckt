use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct RelayBody {
    pub signed_tx: serde_json::Value,
}

#[derive(Serialize)]
pub struct RelayResp {
    pub tx_hash: String,
}

pub async fn submit(
    State(_state): State<AppState>,
    Json(_body): Json<RelayBody>,
) -> ApiResult<Json<RelayResp>> {
    Err(ApiError::Upstream("tx relay not implemented".into()))
}
