use anyhow::{Context, Result};
use sqlx::SqlitePool;

pub async fn purge_expired(pool: &SqlitePool, now: i64) -> Result<u64> {
    let res =
        sqlx::query("DELETE FROM shortlinks WHERE expires_at IS NOT NULL AND expires_at < ?1")
            .bind(now)
            .execute(pool)
            .await
            .context("purge expired shortlinks")?;
    Ok(res.rows_affected())
}
