use anyhow::Context;
use sqlx::SqlitePool;

#[derive(Debug, Clone)]
pub struct SenderProfile {
    pub owner_lock_hash: String,
    pub sender_address: String,
    pub username: String,
}

pub async fn get(pool: &SqlitePool, owner_lock_hash: &str) -> anyhow::Result<Option<SenderProfile>> {
    let row: Option<(String, String, String)> = sqlx::query_as(
        "SELECT owner_lock_hash, sender_address, username
         FROM sender_profiles
         WHERE owner_lock_hash = ?1",
    )
    .bind(owner_lock_hash)
    .fetch_optional(pool)
    .await
    .context("get sender profile")?;

    Ok(row.map(|(owner_lock_hash, sender_address, username)| SenderProfile {
        owner_lock_hash,
        sender_address,
        username,
    }))
}

pub async fn upsert(
    pool: &SqlitePool,
    owner_lock_hash: &str,
    sender_address: &str,
    username: &str,
    updated_at: i64,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO sender_profiles (owner_lock_hash, sender_address, username, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(owner_lock_hash) DO UPDATE SET
           sender_address = excluded.sender_address,
           username = excluded.username,
           updated_at = excluded.updated_at",
    )
    .bind(owner_lock_hash)
    .bind(sender_address)
    .bind(username)
    .bind(updated_at)
    .execute(pool)
    .await
    .context("upsert sender profile")?;
    Ok(())
}
