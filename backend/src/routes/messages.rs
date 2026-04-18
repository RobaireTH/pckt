use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

const MAX_BODY_LEN: usize = 4096;
const HASH_HEX_LEN: usize = 2 + 40;

#[derive(Deserialize)]
pub struct StoreBody {
    pub message_hash: String,
    pub body: String,
}

#[derive(Serialize)]
pub struct StoredAck {
    pub message_hash: String,
    pub stored: bool,
}

#[derive(Serialize)]
pub struct MessageResp {
    pub message_hash: String,
    pub body: String,
    pub created_at: i64,
}

pub async fn store(
    State(state): State<AppState>,
    Json(body): Json<StoreBody>,
) -> ApiResult<Json<StoredAck>> {
    if !is_hex_hash(&body.message_hash) {
        return Err(ApiError::BadRequest(
            "message_hash must be 0x + 40 hex chars (blake160)".into(),
        ));
    }
    if body.body.is_empty() || body.body.len() > MAX_BODY_LEN {
        return Err(ApiError::BadRequest(format!(
            "body must be 1..={MAX_BODY_LEN} bytes"
        )));
    }
    let now = unix_now();
    sqlx::query(
        "INSERT INTO messages (message_hash, body, created_at) VALUES (?1, ?2, ?3) \
         ON CONFLICT(message_hash) DO NOTHING",
    )
    .bind(&body.message_hash)
    .bind(&body.body)
    .bind(now)
    .execute(&state.db)
    .await?;
    Ok(Json(StoredAck {
        message_hash: body.message_hash,
        stored: true,
    }))
}

pub async fn get(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> ApiResult<Json<MessageResp>> {
    if !is_hex_hash(&hash) {
        return Err(ApiError::BadRequest("message_hash format".into()));
    }
    let row: Option<(String, String, i64)> = sqlx::query_as(
        "SELECT message_hash, body, created_at FROM messages WHERE message_hash = ?1",
    )
    .bind(&hash)
    .fetch_optional(&state.db)
    .await?;
    let row = row.ok_or(ApiError::NotFound)?;
    Ok(Json(MessageResp {
        message_hash: row.0,
        body: row.1,
        created_at: row.2,
    }))
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn is_hex_hash(s: &str) -> bool {
    if s.len() != HASH_HEX_LEN || !s.starts_with("0x") {
        return false;
    }
    s[2..].bytes().all(|b| b.is_ascii_hexdigit())
}
