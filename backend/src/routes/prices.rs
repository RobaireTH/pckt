use std::time::{SystemTime, UNIX_EPOCH};

use axum::{extract::State, Json};
use serde::Serialize;

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Serialize)]
pub struct Price {
    pub usd: f64,
    pub ts: i64,
}

pub async fn ckb(State(state): State<AppState>) -> ApiResult<Json<Price>> {
    let resp = reqwest::get(&state.config.price_feed_url)
        .await
        .map_err(|e| ApiError::Upstream(e.to_string()))?;
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| ApiError::Upstream(e.to_string()))?;

    let usd = json
        .get("nervos-network")
        .and_then(|v| v.get("usd"))
        .and_then(|v| v.as_f64())
        .ok_or_else(|| ApiError::Upstream("missing usd field".into()))?;

    Ok(Json(Price {
        usd,
        ts: now_unix(),
    }))
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
