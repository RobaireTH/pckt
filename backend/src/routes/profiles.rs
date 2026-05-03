use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    db,
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Serialize)]
pub struct SenderProfileResp {
    pub owner_lock_hash: String,
    pub sender_address: String,
    pub username: String,
}

#[derive(Deserialize)]
pub struct UpsertProfileBody {
    pub owner_lock_hash: String,
    pub sender_address: String,
    pub username: String,
}

pub async fn get_one(
    State(state): State<AppState>,
    Path(owner_lock_hash): Path<String>,
) -> ApiResult<Json<SenderProfileResp>> {
    let profile = db::profiles::get(&state.db, &owner_lock_hash)
        .await?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(SenderProfileResp {
        owner_lock_hash: profile.owner_lock_hash,
        sender_address: profile.sender_address,
        username: profile.username,
    }))
}

fn is_valid_lock_hash(s: &str) -> bool {
    let body = s.strip_prefix("0x").unwrap_or(s);
    body.len() == 64 && body.bytes().all(|b| b.is_ascii_hexdigit())
}

fn is_valid_address(s: &str) -> bool {
    let len = s.len();
    if !(10..=200).contains(&len) {
        return false;
    }
    s.bytes().all(|b| b.is_ascii_alphanumeric())
}

fn is_valid_username(s: &str) -> bool {
    let len = s.len();
    if !(2..=24).contains(&len) {
        return false;
    }
    if !s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'.' || b == b'-') {
        return false;
    }
    if s.starts_with('.') || s.ends_with('.') || s.contains("..") {
        return false;
    }
    if s.starts_with('-') || s.ends_with('-') {
        return false;
    }
    true
}

pub async fn upsert(
    State(state): State<AppState>,
    Json(body): Json<UpsertProfileBody>,
) -> ApiResult<Json<SenderProfileResp>> {
    let owner_lock_hash = body.owner_lock_hash.trim();
    let sender_address = body.sender_address.trim();
    let username = body.username.trim();

    if !is_valid_lock_hash(owner_lock_hash) {
        return Err(ApiError::BadRequest("owner_lock_hash must be 32-byte hex".into()));
    }
    if !is_valid_address(sender_address) {
        return Err(ApiError::BadRequest("sender_address is invalid".into()));
    }
    if !is_valid_username(username) {
        return Err(ApiError::BadRequest(
            "username must be 2-24 chars of [A-Za-z0-9_.-], no leading/trailing/double dots or leading/trailing hyphens".into(),
        ));
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    db::profiles::upsert(&state.db, owner_lock_hash, sender_address, username, now).await?;

    Ok(Json(SenderProfileResp {
        owner_lock_hash: owner_lock_hash.into(),
        sender_address: sender_address.into(),
        username: username.into(),
    }))
}
