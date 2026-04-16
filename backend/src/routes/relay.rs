use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{
    ckb::CkbRpc,
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Deserialize)]
pub struct RelayBody { pub signed_tx: serde_json::Value }

#[derive(Serialize)]
pub struct RelayResp { pub tx_hash: String }

pub async fn submit(
    State(state): State<AppState>,
    Json(body): Json<RelayBody>,
) -> ApiResult<Json<RelayResp>> {
    if !body.signed_tx.is_object() {
        return Err(ApiError::BadRequest("signed_tx must be a tx object".into()));
    }
    let rpc = CkbRpc::new(state.config.ckb_rpc_url.clone());
    let tx_hash = rpc.send_transaction(body.signed_tx).await
        .map_err(|e| ApiError::Upstream(e.to_string()))?;
    Ok(Json(RelayResp { tx_hash }))
}
