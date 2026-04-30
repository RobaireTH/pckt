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
    let tx_hash = rpc.send_transaction(body.signed_tx).await.map_err(|e| {
        tracing::error!(?e, "relay transaction failed");
        classify_relay_error(&e.to_string())
    })?;
    Ok(Json(RelayResp { tx_hash }))
}

fn classify_relay_error(msg: &str) -> ApiError {
    if msg.contains("error code 55") {
        return ApiError::Conflict("This wallet already claimed this packet.".into());
    }
    if msg.contains("error code 54") {
        return ApiError::Conflict("This packet has already been fully claimed.".into());
    }
    if msg.contains("error code 53") {
        return ApiError::Conflict("This packet is still sealed and cannot be claimed yet.".into());
    }
    if msg.contains("error code 80") {
        return ApiError::Conflict("This packet cannot be reclaimed until it expires.".into());
    }
    if msg.contains("error code 82") {
        return ApiError::Conflict("This packet still has an active successor and cannot be reclaimed.".into());
    }
    if msg.contains("InsufficientCellCapacity") {
        return ApiError::BadRequest(
            "The resulting claim cell is below CKB's minimum live-cell capacity.".into(),
        );
    }
    ApiError::Upstream(msg.into())
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

#[cfg(test)]
mod tests {
    use super::classify_relay_error;
    use crate::error::ApiError;

    #[test]
    fn maps_already_claimed_to_conflict() {
        let err = classify_relay_error("ckb rpc error: ... error code 55 ...");
        match err {
            ApiError::Conflict(msg) => assert!(msg.contains("already claimed")),
            other => panic!("expected conflict, got {other:?}"),
        }
    }

    #[test]
    fn maps_packet_full_to_conflict() {
        let err = classify_relay_error("ckb rpc error: ... error code 54 ...");
        match err {
            ApiError::Conflict(msg) => assert!(msg.contains("fully claimed")),
            other => panic!("expected conflict, got {other:?}"),
        }
    }

    #[test]
    fn maps_reclaim_before_expiry_to_conflict() {
        let err = classify_relay_error("ckb rpc error: ... error code 80 ...");
        match err {
            ApiError::Conflict(msg) => assert!(msg.contains("reclaimed until it expires")),
            other => panic!("expected conflict, got {other:?}"),
        }
    }
}
