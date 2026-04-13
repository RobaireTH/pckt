use anyhow::{Context, Result};
use pckt_types::PacketState;
use sqlx::SqlitePool;

use crate::crypto::{blake160, hex_str};

pub struct PacketRow<'a> {
    pub out_point: &'a str,
    pub state: &'a PacketState,
    pub current_capacity: u64,
    pub sealed_at: u64,
    pub block_number: u64,
}

pub async fn upsert(pool: &SqlitePool, row: PacketRow<'_>) -> Result<()> {
    let claim_pubkey_hash = hex_str(&blake160(&row.state.claim_pubkey));
    sqlx::query(
        "INSERT INTO packets (\
            out_point, packet_type, slots_total, slots_claimed, \
            initial_capacity, current_capacity, expiry, unlock_time, \
            owner_lock_hash, claim_pubkey_hash, salt, message_hash, \
            message_body, sealed_at, last_seen_block) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, ?13, ?14) \
         ON CONFLICT(out_point) DO UPDATE SET \
            slots_claimed = excluded.slots_claimed, \
            current_capacity = excluded.current_capacity, \
            last_seen_block = excluded.last_seen_block",
    )
    .bind(row.out_point)
    .bind(row.state.packet_type as u8 as i64)
    .bind(row.state.slots_total as i64)
    .bind(row.state.slots_claimed as i64)
    .bind(row.state.initial_capacity.to_string())
    .bind(row.current_capacity.to_string())
    .bind(row.state.expiry as i64)
    .bind(row.state.unlock_time as i64)
    .bind(hex_str(&row.state.owner_lock_hash))
    .bind(claim_pubkey_hash)
    .bind(row.state.salt.clone())
    .bind(row.state.message_hash.clone())
    .bind(row.sealed_at as i64)
    .bind(row.block_number as i64)
    .execute(pool)
    .await
    .context("upsert packet")?;
    Ok(())
}

pub async fn lookup(pool: &SqlitePool, out_point: &str) -> Result<Option<(String, String)>> {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT owner_lock_hash, claim_pubkey_hash FROM packets WHERE out_point = ?1",
    )
    .bind(out_point)
    .fetch_optional(pool)
    .await
    .context("lookup packet")?;
    Ok(row)
}

#[allow(clippy::too_many_arguments)]
pub async fn record_event(
    pool: &SqlitePool,
    out_point: &str,
    event_type: &str,
    tx_hash: &str,
    block_number: u64,
    ts: u64,
    claimer_lock_hash: Option<&str>,
    slot_amount: Option<&str>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO packet_events (\
            out_point, event_type, tx_hash, block_number, ts, \
            claimer_lock_hash, slot_amount) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(out_point)
    .bind(event_type)
    .bind(tx_hash)
    .bind(block_number as i64)
    .bind(ts as i64)
    .bind(claimer_lock_hash)
    .bind(slot_amount)
    .execute(pool)
    .await
    .context("insert packet event")?;
    Ok(())
}
