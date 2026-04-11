use anyhow::{Context, Result};
use sqlx::SqlitePool;

const KEY: &str = "indexer_cursor";

pub async fn load(pool: &SqlitePool) -> Result<u64> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM meta WHERE key = ?1")
        .bind(KEY)
        .fetch_optional(pool)
        .await
        .context("load indexer cursor")?;
    let value = row.map(|r| r.0).unwrap_or_else(|| "0".into());
    Ok(value.parse().unwrap_or(0))
}

pub async fn store(pool: &SqlitePool, block: u64) -> Result<()> {
    sqlx::query(
        "INSERT INTO meta (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(KEY)
    .bind(block.to_string())
    .execute(pool)
    .await
    .context("store indexer cursor")?;
    Ok(())
}
