use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};

const LIST_LIMIT: i64 = 100;

type SummaryRow = (
    String,
    i64,
    i64,
    i64,
    String,
    String,
    i64,
    i64,
    String,
    String,
    Vec<u8>,
    Option<String>,
);
type ClaimedRow = (
    String,
    i64,
    i64,
    i64,
    String,
    String,
    i64,
    i64,
    String,
    String,
    Vec<u8>,
    Option<String>,
    String,
    i64,
    Option<String>,
);
type EventRow = (String, String, i64, i64, Option<String>, Option<String>);

const SELECT_SUMMARY: &str = r#"
    SELECT out_point, packet_type, slots_total, slots_claimed,
           initial_capacity, current_capacity, expiry, unlock_time,
           owner_lock_hash, claim_pubkey_hash, salt, message_body
    FROM packets
"#;

#[derive(Deserialize)]
pub struct ListQuery {
    pub owner: Option<String>,
}

#[derive(Deserialize)]
pub struct ClaimedQuery {
    pub claimer: Option<String>,
}

#[derive(Serialize)]
pub struct PacketSummary {
    pub out_point: String,
    pub packet_type: u8,
    pub slots_total: u8,
    pub slots_claimed: u8,
    pub initial_capacity: String,
    pub current_capacity: String,
    pub expiry: u64,
    pub unlock_time: u64,
    pub owner_lock_hash: String,
    pub claim_pubkey_hash: String,
    pub salt: String,
    pub message_body: Option<String>,
}

#[derive(Serialize)]
pub struct PacketEvent {
    pub event_type: String,
    pub tx_hash: String,
    pub block_number: u64,
    pub ts: u64,
    pub claimer_lock_hash: Option<String>,
    pub slot_amount: Option<String>,
}

#[derive(Serialize)]
pub struct ClaimedPacket {
    #[serde(flatten)]
    pub packet: PacketSummary,
    pub claim_tx_hash: String,
    pub claim_ts: u64,
    pub slot_amount: Option<String>,
}

fn row_to_summary(r: SummaryRow) -> PacketSummary {
    PacketSummary {
        out_point: r.0,
        packet_type: r.1 as u8,
        slots_total: r.2 as u8,
        slots_claimed: r.3 as u8,
        initial_capacity: r.4,
        current_capacity: r.5,
        expiry: r.6 as u64,
        unlock_time: r.7 as u64,
        owner_lock_hash: r.8,
        claim_pubkey_hash: r.9,
        salt: format!(
            "0x{}",
            r.10.iter().map(|b| format!("{b:02x}")).collect::<String>()
        ),
        message_body: r.11,
    }
}

pub async fn list(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Vec<PacketSummary>>> {
    let owner = q.owner.unwrap_or_default();
    let sql = format!(
        "{SELECT_SUMMARY} WHERE (?1 = '' OR owner_lock_hash = ?1) \
         ORDER BY sealed_at DESC LIMIT ?2"
    );
    let rows: Vec<SummaryRow> = sqlx::query_as(&sql)
        .bind(&owner)
        .bind(LIST_LIMIT)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows.into_iter().map(row_to_summary).collect()))
}

pub async fn get_one(
    State(state): State<AppState>,
    Path(outpoint): Path<String>,
) -> ApiResult<Json<PacketSummary>> {
    let sql = format!("{SELECT_SUMMARY} WHERE out_point = ?1");
    let row: SummaryRow = sqlx::query_as(&sql)
        .bind(&outpoint)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(row_to_summary(row)))
}

pub async fn claimed(
    State(state): State<AppState>,
    Query(q): Query<ClaimedQuery>,
) -> ApiResult<Json<Vec<ClaimedPacket>>> {
    let claimer = q.claimer.unwrap_or_default();
    if claimer.is_empty() {
        return Ok(Json(Vec::new()));
    }

    let sql = r#"
        SELECT p.out_point, p.packet_type, p.slots_total, p.slots_claimed,
               p.initial_capacity, p.current_capacity, p.expiry, p.unlock_time,
               p.owner_lock_hash, p.claim_pubkey_hash, p.salt, p.message_body,
               e.tx_hash, e.ts, e.slot_amount
        FROM packets p
        JOIN packet_events e ON e.out_point = p.out_point
        WHERE e.event_type = 'claim'
          AND e.claimer_lock_hash = ?1
        ORDER BY e.ts DESC, e.id DESC
        LIMIT ?2
    "#;

    let rows: Vec<ClaimedRow> = sqlx::query_as(sql)
        .bind(&claimer)
        .bind(LIST_LIMIT)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| ClaimedPacket {
                packet: row_to_summary((
                    r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11,
                )),
                claim_tx_hash: r.12,
                claim_ts: r.13 as u64,
                slot_amount: r.14,
            })
            .collect(),
    ))
}

pub async fn by_pubkey(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> ApiResult<Json<PacketSummary>> {
    let sql = format!(
        "{SELECT_SUMMARY} WHERE claim_pubkey_hash = ?1 \
         ORDER BY sealed_at DESC LIMIT 1"
    );
    let row: SummaryRow = sqlx::query_as(&sql)
        .bind(&hash)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(row_to_summary(row)))
}

pub async fn events(
    State(state): State<AppState>,
    Path(outpoint): Path<String>,
) -> ApiResult<Json<Vec<PacketEvent>>> {
    let rows: Vec<EventRow> = sqlx::query_as(
        r#"
        SELECT event_type, tx_hash, block_number, ts, claimer_lock_hash, slot_amount
        FROM packet_events
        WHERE out_point = ?1
        ORDER BY block_number ASC, id ASC
        "#,
    )
    .bind(&outpoint)
    .fetch_all(&state.db)
    .await?;

    let events = rows
        .into_iter()
        .map(|r| PacketEvent {
            event_type: r.0,
            tx_hash: r.1,
            block_number: r.2 as u64,
            ts: r.3 as u64,
            claimer_lock_hash: r.4,
            slot_amount: r.5,
        })
        .collect();
    Ok(Json(events))
}
