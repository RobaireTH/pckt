use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::{extract::State, Json};
use serde::Serialize;

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

const CACHE_TTL: Duration = Duration::from_secs(30);

#[derive(Serialize, Clone)]
pub struct Price {
    pub usd: f64,
    pub ts: i64,
}

static CACHE: OnceLock<Mutex<Option<(Price, std::time::Instant)>>> = OnceLock::new();

pub async fn ckb(State(state): State<AppState>) -> ApiResult<Json<Price>> {
    if let Some(cached) = read_cache() {
        return Ok(Json(cached));
    }

    let resp = reqwest::get(&state.config.price_feed_url)
        .await
        .map_err(|e| ApiError::Upstream(e.to_string()))?
        .error_for_status()
        .map_err(|e| ApiError::Upstream(e.to_string()))?;
    let body = resp
        .text()
        .await
        .map_err(|e| ApiError::Upstream(e.to_string()))?;
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| ApiError::Upstream(e.to_string()))?;

    let usd = extract_usd(&json)
        .ok_or_else(|| ApiError::Upstream(price_error_message(&json, &body)))?;

    let price = Price {
        usd,
        ts: now_unix(),
    };
    write_cache(price.clone());
    Ok(Json(price))
}

fn read_cache() -> Option<Price> {
    let cell = CACHE.get_or_init(|| Mutex::new(None));
    let guard = cell.lock().ok()?;
    let (price, at) = guard.as_ref()?;
    if at.elapsed() < CACHE_TTL {
        Some(price.clone())
    } else {
        None
    }
}

fn write_cache(price: Price) {
    let cell = CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = cell.lock() {
        *guard = Some((price, std::time::Instant::now()));
    }
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn extract_usd(json: &serde_json::Value) -> Option<f64> {
    json.get("nervos-network")
        .and_then(|v| v.get("usd"))
        .and_then(|v| v.as_f64())
        .or_else(|| json.get("USD").and_then(|v| v.as_f64()))
        .or_else(|| json.get("usd").and_then(|v| v.as_f64()))
        .or_else(|| {
            json.as_array()
                .and_then(|items| items.first())
                .and_then(|v| v.get("current_price"))
                .and_then(|v| v.as_f64())
        })
        .or_else(|| {
            json.get("quotes")
                .and_then(|v| v.get("USD"))
                .and_then(|v| v.get("price"))
                .and_then(|v| v.as_f64())
        })
        .or_else(|| {
            json.get("market_data")
                .and_then(|v| v.get("current_price"))
                .and_then(|v| v.get("usd"))
                .and_then(|v| v.as_f64())
        })
}

fn price_error_message(json: &serde_json::Value, body: &str) -> String {
    json.get("status")
        .and_then(|v| v.get("error_message"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| json.get("error").and_then(|v| v.as_str()).map(str::to_string))
        .unwrap_or_else(|| {
            let snippet: String = body.chars().take(200).collect();
            format!("missing usd field: {snippet}")
        })
}
