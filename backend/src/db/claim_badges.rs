use anyhow::{Context, Result};
use sqlx::{FromRow, SqlitePool};

pub struct ClaimBadgeRow<'a> {
    pub out_point: &'a str,
    pub packet_out_point: &'a str,
    pub claim_tx_hash: &'a str,
    pub block_number: u64,
    pub ts: u64,
    pub owner_lock_hash: &'a str,
    pub claimer_lock_hash: &'a str,
    pub claim_pubkey_hash: &'a str,
    pub scope_id: &'a str,
    pub slot_index: u8,
    pub slot_amount: Option<&'a str>,
    pub metadata_json: &'a str,
}

#[derive(Debug, Clone, FromRow)]
pub struct ClaimBadge {
    pub out_point: String,
    pub packet_out_point: String,
    pub claim_tx_hash: String,
    pub block_number: i64,
    pub ts: i64,
    pub owner_lock_hash: String,
    pub claimer_lock_hash: String,
    pub claim_pubkey_hash: String,
    pub scope_id: String,
    pub slot_index: i64,
    pub slot_amount: Option<String>,
    pub metadata_json: String,
}

pub async fn record(pool: &SqlitePool, row: ClaimBadgeRow<'_>) -> Result<()> {
    sqlx::query(
        "INSERT INTO claim_badges (\
            out_point, packet_out_point, claim_tx_hash, block_number, ts, \
            owner_lock_hash, claimer_lock_hash, claim_pubkey_hash, scope_id, \
            slot_index, slot_amount, metadata_json) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) \
         ON CONFLICT(packet_out_point, claim_tx_hash, claimer_lock_hash) DO UPDATE SET \
            out_point = excluded.out_point, \
            block_number = excluded.block_number, \
            ts = excluded.ts, \
            slot_amount = excluded.slot_amount, \
            metadata_json = excluded.metadata_json",
    )
    .bind(row.out_point)
    .bind(row.packet_out_point)
    .bind(row.claim_tx_hash)
    .bind(row.block_number as i64)
    .bind(row.ts as i64)
    .bind(row.owner_lock_hash)
    .bind(row.claimer_lock_hash)
    .bind(row.claim_pubkey_hash)
    .bind(row.scope_id)
    .bind(row.slot_index as i64)
    .bind(row.slot_amount)
    .bind(row.metadata_json)
    .execute(pool)
    .await
    .context("record claim badge")?;
    Ok(())
}

pub async fn find_for_claim(
    pool: &SqlitePool,
    packet_out_point: &str,
    claim_tx_hash: &str,
    claimer_lock_hash: &str,
) -> Result<Option<ClaimBadge>> {
    sqlx::query_as(
        "SELECT out_point, packet_out_point, claim_tx_hash, block_number, ts, \
                owner_lock_hash, claimer_lock_hash, claim_pubkey_hash, scope_id, \
                slot_index, slot_amount, metadata_json \
         FROM claim_badges \
         WHERE packet_out_point = ?1 AND claim_tx_hash = ?2 AND claimer_lock_hash = ?3",
    )
    .bind(packet_out_point)
    .bind(claim_tx_hash)
    .bind(claimer_lock_hash)
    .fetch_optional(pool)
    .await
    .context("find claim badge")
}
