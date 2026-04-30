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

pub async fn upsert(
    State(state): State<AppState>,
    Json(body): Json<UpsertProfileBody>,
) -> ApiResult<Json<SenderProfileResp>> {
    let owner_lock_hash = body.owner_lock_hash.trim();
    let sender_address = body.sender_address.trim();
    let username = body.username.trim();

    if owner_lock_hash.is_empty() || sender_address.is_empty() {
        return Err(ApiError::BadRequest("owner_lock_hash and sender_address are required".into()));
    }
    if username.len() < 2 || username.len() > 24 {
        return Err(ApiError::BadRequest("username must be between 2 and 24 characters".into()));
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
