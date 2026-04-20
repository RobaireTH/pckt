use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    extract::{Path, State},
    response::Redirect,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

const SLUG_ALPHABET: &[u8] = b"abcdefghijkmnpqrstuvwxyz23456789";
const SLUG_LEN: usize = 8;

#[derive(Deserialize)]
pub struct CreateLink {
    pub full_url: String,
    pub ttl: Option<i64>,
}

#[derive(Serialize)]
pub struct CreatedLink {
    pub slug: String,
    pub short_url: String,
}

pub async fn create(
    State(state): State<AppState>,
    Json(body): Json<CreateLink>,
) -> ApiResult<Json<CreatedLink>> {
    if !(body.full_url.starts_with("http://") || body.full_url.starts_with("https://")) {
        return Err(ApiError::BadRequest("full_url must be http(s)".into()));
    }

    let now = unix_now();
    let expires_at = body.ttl.map(|ttl| now + ttl);

    let slug = insert_with_retry(&state, &body.full_url, now, expires_at).await?;

    Ok(Json(CreatedLink {
        short_url: format!("{}/l/{slug}", state.config.shortlink_base),
        slug,
    }))
}

const SLUG_RETRIES: usize = 5;

async fn insert_with_retry(
    state: &AppState,
    full_url: &str,
    now: i64,
    expires_at: Option<i64>,
) -> ApiResult<String> {
    for _ in 0..SLUG_RETRIES {
        let slug = generate_slug();
        let result = sqlx::query(
            "INSERT INTO shortlinks (slug, full_url, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&slug)
        .bind(full_url)
        .bind(now)
        .bind(expires_at)
        .execute(&state.db)
        .await;
        match result {
            Ok(_) => return Ok(slug),
            Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => continue,
            Err(e) => return Err(e.into()),
        }
    }
    Err(ApiError::Upstream("could not allocate slug".into()))
}

pub async fn redirect(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Redirect> {
    let row: Option<(String, Option<i64>)> =
        sqlx::query_as("SELECT full_url, expires_at FROM shortlinks WHERE slug = ?1")
            .bind(&slug)
            .fetch_optional(&state.db)
            .await?;

    let (full_url, expires_at) = row.ok_or(ApiError::NotFound)?;
    if let Some(exp) = expires_at {
        if unix_now() > exp {
            return Err(ApiError::NotFound);
        }
    }
    Ok(Redirect::to(&full_url))
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn generate_slug() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let mut seed = nanos ^ 0x9E37_79B9_7F4A_7C15;
    let mut out = String::with_capacity(SLUG_LEN);
    for _ in 0..SLUG_LEN {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let idx = (seed >> 33) as usize % SLUG_ALPHABET.len();
        out.push(SLUG_ALPHABET[idx] as char);
    }
    out
}
