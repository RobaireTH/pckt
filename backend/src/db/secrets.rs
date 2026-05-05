use anyhow::Context;
use sqlx::SqlitePool;

#[derive(Debug, Clone)]
pub struct PacketSecret {
    pub out_point: String,
    pub owner_lock_hash: String,
    pub sk_ciphertext: Vec<u8>,
    pub sk_nonce: Vec<u8>,
}

pub async fn get(pool: &SqlitePool, out_point: &str) -> anyhow::Result<Option<PacketSecret>> {
    let row: Option<(String, String, Vec<u8>, Vec<u8>)> = sqlx::query_as(
        "SELECT out_point, owner_lock_hash, sk_ciphertext, sk_nonce
         FROM packet_secrets WHERE out_point = ?1",
    )
    .bind(out_point)
    .fetch_optional(pool)
    .await
    .context("get packet secret")?;
    Ok(row.map(
        |(out_point, owner_lock_hash, sk_ciphertext, sk_nonce)| PacketSecret {
            out_point,
            owner_lock_hash,
            sk_ciphertext,
            sk_nonce,
        },
    ))
}

pub async fn insert_if_absent(
    pool: &SqlitePool,
    secret: &PacketSecret,
    created_at: i64,
) -> anyhow::Result<bool> {
    let res = sqlx::query(
        "INSERT OR IGNORE INTO packet_secrets
           (out_point, owner_lock_hash, sk_ciphertext, sk_nonce, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&secret.out_point)
    .bind(&secret.owner_lock_hash)
    .bind(&secret.sk_ciphertext)
    .bind(&secret.sk_nonce)
    .bind(created_at)
    .execute(pool)
    .await
    .context("insert packet secret")?;
    Ok(res.rows_affected() > 0)
}

pub async fn owner_has_any_token(pool: &SqlitePool, owner_lock_hash: &str) -> anyhow::Result<bool> {
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT 1 FROM device_tokens WHERE owner_lock_hash = ?1 LIMIT 1")
            .bind(owner_lock_hash)
            .fetch_optional(pool)
            .await
            .context("owner_has_any_token")?;
    Ok(row.is_some())
}

pub async fn token_is_paired(
    pool: &SqlitePool,
    owner_lock_hash: &str,
    token_hash: &str,
) -> anyhow::Result<bool> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM device_tokens WHERE owner_lock_hash = ?1 AND token_hash = ?2 LIMIT 1",
    )
    .bind(owner_lock_hash)
    .bind(token_hash)
    .fetch_optional(pool)
    .await
    .context("token_is_paired")?;
    Ok(row.is_some())
}

pub async fn pair_token(
    pool: &SqlitePool,
    owner_lock_hash: &str,
    token_hash: &str,
    created_at: i64,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO device_tokens (token_hash, owner_lock_hash, created_at)
         VALUES (?1, ?2, ?3)",
    )
    .bind(token_hash)
    .bind(owner_lock_hash)
    .bind(created_at)
    .execute(pool)
    .await
    .context("pair device token")?;
    Ok(())
}
