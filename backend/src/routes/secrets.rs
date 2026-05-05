use axum::{extract::State, Json};
use ckb_hash::blake2b_256;
use serde::{Deserialize, Serialize};

use crate::{
    crypto::{aead_decrypt, decode_hex, hex_str},
    db::{self, secrets::PacketSecret},
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Deserialize)]
pub struct StoreSecretBody {
    pub out_point: String,
    pub owner_lock_hash: String,
    pub claim_sk: String,
    pub device_token: String,
}

#[derive(Serialize)]
pub struct StoreSecretResp {
    pub paired: bool,
}

#[derive(Deserialize)]
pub struct PairBody {
    pub owner_lock_hash: String,
    pub device_token: String,
    pub existing_token: String,
}

#[derive(Deserialize)]
pub struct RetrieveSecretBody {
    pub out_point: String,
    pub device_token: String,
}

#[derive(Serialize)]
pub struct RetrieveSecretResp {
    pub claim_sk: String,
}

fn is_valid_lock_hash(s: &str) -> bool {
    let body = s.strip_prefix("0x").unwrap_or(s);
    body.len() == 64 && body.bytes().all(|b| b.is_ascii_hexdigit())
}

fn is_valid_out_point(s: &str) -> bool {
    let mut parts = s.split(':');
    let tx = parts.next().unwrap_or("");
    let idx = parts.next().unwrap_or("");
    if parts.next().is_some() {
        return false;
    }
    let tx_body = tx.strip_prefix("0x").unwrap_or(tx);
    if tx_body.len() != 64 || !tx_body.bytes().all(|b| b.is_ascii_hexdigit()) {
        return false;
    }
    if idx.is_empty() {
        return false;
    }
    if let Some(stripped) = idx.strip_prefix("0x").or_else(|| idx.strip_prefix("0X")) {
        return !stripped.is_empty() && stripped.bytes().all(|b| b.is_ascii_hexdigit());
    }
    idx.bytes().all(|b| b.is_ascii_digit())
}

fn is_valid_token(s: &str) -> bool {
    let len = s.len();
    (16..=128).contains(&len)
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn is_valid_claim_sk(s: &str) -> bool {
    let body = s.strip_prefix("0x").unwrap_or(s);
    body.len() == 64 && body.bytes().all(|b| b.is_ascii_hexdigit())
}

fn token_hash(token: &str) -> String {
    hex_str(&blake2b_256(token.as_bytes()))
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub async fn store(
    State(state): State<AppState>,
    Json(body): Json<StoreSecretBody>,
) -> ApiResult<Json<StoreSecretResp>> {
    let out_point = body.out_point.trim();
    let owner = body.owner_lock_hash.trim();
    let token = body.device_token.trim();
    let sk = body.claim_sk.trim();

    if !is_valid_out_point(out_point) {
        return Err(ApiError::BadRequest("out_point is invalid".into()));
    }
    if !is_valid_lock_hash(owner) {
        return Err(ApiError::BadRequest(
            "owner_lock_hash must be 32-byte hex".into(),
        ));
    }
    if !is_valid_token(token) {
        return Err(ApiError::BadRequest("device_token is invalid".into()));
    }
    if !is_valid_claim_sk(sk) {
        return Err(ApiError::BadRequest("claim_sk must be 32-byte hex".into()));
    }

    let th = token_hash(token);
    let pool = &state.db;

    let owner_paired = db::secrets::owner_has_any_token(pool, owner).await?;
    let token_known = db::secrets::token_is_paired(pool, owner, &th).await?;
    if owner_paired && !token_known {
        return Err(ApiError::Unauthorized(
            "this device is not paired with the sender".into(),
        ));
    }

    let sk_bytes = decode_hex(sk).ok_or_else(|| ApiError::BadRequest("claim_sk hex".into()))?;
    let (ciphertext, nonce) = crate::crypto::aead_encrypt(state.secret_key.as_ref(), &sk_bytes)
        .map_err(ApiError::Other)?;

    let now = now_secs();
    if !owner_paired {
        db::secrets::pair_token(pool, owner, &th, now).await?;
    }
    db::secrets::insert_if_absent(
        pool,
        &PacketSecret {
            out_point: out_point.into(),
            owner_lock_hash: owner.into(),
            sk_ciphertext: ciphertext,
            sk_nonce: nonce.to_vec(),
        },
        now,
    )
    .await?;

    Ok(Json(StoreSecretResp { paired: true }))
}

pub async fn pair(
    State(state): State<AppState>,
    Json(body): Json<PairBody>,
) -> ApiResult<Json<StoreSecretResp>> {
    let owner = body.owner_lock_hash.trim();
    let new_token = body.device_token.trim();
    let existing = body.existing_token.trim();

    if !is_valid_lock_hash(owner) {
        return Err(ApiError::BadRequest(
            "owner_lock_hash must be 32-byte hex".into(),
        ));
    }
    if !is_valid_token(new_token) || !is_valid_token(existing) {
        return Err(ApiError::BadRequest("device_token is invalid".into()));
    }

    let pool = &state.db;
    let existing_hash = token_hash(existing);
    if !db::secrets::token_is_paired(pool, owner, &existing_hash).await? {
        return Err(ApiError::Unauthorized(
            "existing token is not paired with this sender".into(),
        ));
    }

    let new_hash = token_hash(new_token);
    db::secrets::pair_token(pool, owner, &new_hash, now_secs()).await?;
    Ok(Json(StoreSecretResp { paired: true }))
}

pub async fn retrieve(
    State(state): State<AppState>,
    Json(body): Json<RetrieveSecretBody>,
) -> ApiResult<Json<RetrieveSecretResp>> {
    let out_point = body.out_point.trim();
    let token = body.device_token.trim();
    if !is_valid_out_point(out_point) {
        return Err(ApiError::BadRequest("out_point is invalid".into()));
    }
    if !is_valid_token(token) {
        return Err(ApiError::BadRequest("device_token is invalid".into()));
    }

    let pool = &state.db;
    let secret = db::secrets::get(pool, out_point)
        .await?
        .ok_or(ApiError::NotFound)?;
    let th = token_hash(token);
    if !db::secrets::token_is_paired(pool, &secret.owner_lock_hash, &th).await? {
        return Err(ApiError::Unauthorized(
            "device is not paired with this sender".into(),
        ));
    }

    let plaintext = aead_decrypt(
        state.secret_key.as_ref(),
        &secret.sk_nonce,
        &secret.sk_ciphertext,
    )
    .map_err(ApiError::Other)?;
    let sk_hex = hex_str(&plaintext);
    Ok(Json(RetrieveSecretResp { claim_sk: sk_hex }))
}
