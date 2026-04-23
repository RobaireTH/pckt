use axum::{extract::State, http::HeaderMap, Json};
use serde::{Deserialize, Serialize};

use crate::{
    ckb::CkbRpc,
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
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RelayBody>,
) -> ApiResult<Json<RelayResp>> {
    enforce_origin(&headers, &state.config.allowed_origins)?;

    if !body.signed_tx.is_object() {
        return Err(ApiError::BadRequest("signed_tx must be a tx object".into()));
    }
    let rpc = CkbRpc::new(state.config.ckb_rpc_url.clone());
    let tx_hash = rpc
        .send_transaction(body.signed_tx)
        .await
        .map_err(|e| ApiError::Upstream(e.to_string()))?;
    Ok(Json(RelayResp { tx_hash }))
}

fn enforce_origin(headers: &HeaderMap, allowed: &[String]) -> ApiResult<()> {
    if allowed.iter().any(|s| s == "*") {
        return Ok(());
    }
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::BadRequest("Origin header required".into()))?;
    if !allowed.iter().any(|a| a == origin) {
        return Err(ApiError::BadRequest("origin not allowed".into()));
    }
    Ok(())
}
