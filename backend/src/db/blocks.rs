use anyhow::{Context, Result};
use sqlx::SqlitePool;

const RETAIN: u64 = 200;

pub async fn record(pool: &SqlitePool, number: u64, hash: &str) -> Result<()> {
    sqlx::query(
        "INSERT INTO block_hashes (number, hash) VALUES (?1, ?2) \
         ON CONFLICT(number) DO UPDATE SET hash = excluded.hash",
    )
    .bind(number as i64)
    .bind(hash)
    .execute(pool)
    .await
    .context("record block hash")?;

    let cutoff = number.saturating_sub(RETAIN) as i64;
    sqlx::query("DELETE FROM block_hashes WHERE number < ?1")
        .bind(cutoff)
        .execute(pool)
        .await
        .context("trim block hashes")?;
    Ok(())
}

pub async fn hash_at(pool: &SqlitePool, number: u64) -> Result<Option<String>> {
    let row: Option<(String,)> = sqlx::query_as("SELECT hash FROM block_hashes WHERE number = ?1")
        .bind(number as i64)
        .fetch_optional(pool)
        .await
        .context("lookup block hash")?;
    Ok(row.map(|r| r.0))
}

pub async fn rollback(pool: &SqlitePool, from: u64) -> Result<()> {
    sqlx::query("DELETE FROM block_hashes WHERE number >= ?1")
        .bind(from as i64)
        .execute(pool)
        .await
        .context("rollback block hashes")?;
    sqlx::query("DELETE FROM packet_events WHERE block_number >= ?1")
        .bind(from as i64)
        .execute(pool)
        .await
        .context("rollback packet events")?;
    sqlx::query("DELETE FROM packets WHERE last_seen_block >= ?1")
        .bind(from as i64)
        .execute(pool)
        .await
        .context("rollback packets")?;
    Ok(())
}
