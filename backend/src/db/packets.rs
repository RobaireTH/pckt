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
    let message_body = (!row.state.message.is_empty()).then(|| decode_message(&row.state.message));
    sqlx::query(
        "INSERT INTO packets (\
            out_point, packet_type, slots_total, slots_claimed, \
            initial_capacity, current_capacity, expiry, unlock_time, \
            owner_lock_hash, claim_pubkey_hash, salt, message_hash, \
            message_body, sealed_at, last_seen_block) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15) \
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
    .bind(blake160(&row.state.message).to_vec())
    .bind(message_body)
    .bind(row.sealed_at as i64)
    .bind(row.block_number as i64)
    .execute(pool)
    .await
    .context("upsert packet")?;
    Ok(())
}

fn decode_message(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => String::from_utf8_lossy(bytes).into_owned(),
    }
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

#[derive(Debug, Clone)]
pub struct PacketSnapshot {
    pub owner_lock_hash: String,
    pub claim_pubkey_hash: String,
    pub salt: Vec<u8>,
    pub slots_total: u8,
    pub slots_claimed: u8,
    pub current_capacity: u64,
}

pub async fn snapshot(pool: &SqlitePool, out_point: &str) -> Result<Option<PacketSnapshot>> {
    let row: Option<(String, String, Vec<u8>, i64, i64, String)> = sqlx::query_as(
        "SELECT owner_lock_hash, claim_pubkey_hash, salt, slots_total, slots_claimed, current_capacity \
         FROM packets WHERE out_point = ?1",
    )
    .bind(out_point)
    .fetch_optional(pool)
    .await
    .context("snapshot packet")?;
    Ok(row.map(
        |(owner, pubkey, salt, total, claimed, capacity)| PacketSnapshot {
            owner_lock_hash: owner,
            claim_pubkey_hash: pubkey,
            salt,
            slots_total: total as u8,
            slots_claimed: claimed as u8,
            current_capacity: capacity.parse().unwrap_or(0),
        },
    ))
}

pub async fn mark_terminal(
    pool: &SqlitePool,
    out_point: &str,
    slots_claimed: u8,
    current_capacity: u64,
    block_number: u64,
) -> Result<()> {
    sqlx::query(
        "UPDATE packets
         SET slots_claimed = ?2,
             current_capacity = ?3,
             last_seen_block = ?4
         WHERE out_point = ?1",
    )
    .bind(out_point)
    .bind(slots_claimed as i64)
    .bind(current_capacity.to_string())
    .bind(block_number as i64)
    .execute(pool)
    .await
    .context("mark packet terminal")?;
    Ok(())
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
