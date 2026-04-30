use std::time::Duration;

use anyhow::Context;
use pckt_types::PacketState;
use serde_json::Value;
use tracing::{debug, info, warn};

use crate::{
    bus::{EventBus, PacketEventMsg},
    ckb::CkbRpc,
    crypto::{decode_hex, hash_type_byte, hex_str, script_hash},
    db::{
        self,
        packets::{PacketRow, PacketSnapshot},
    },
    state::AppState,
};

const TICK_INTERVAL_SECS: u64 = 30;
const SCAN_BATCH: u64 = 64;
const REORG_DEPTH: u64 = 50;
const BACKOFF_MAX_SECS: u64 = 300;

const BACKFILL_THRESHOLD: u64 = 1024;
const BACKFILL_PAGE: u32 = 100;

pub struct Indexer {
    state: AppState,
    rpc: CkbRpc,
    indexer_rpc: CkbRpc,
}

struct NewPacket {
    out_point: String,
    state: PacketState,
    capacity: u64,
}

struct Predecessor {
    out_point: String,
    snapshot: PacketSnapshot,
}

impl Indexer {
    pub fn new(state: AppState) -> Self {
        let rpc = CkbRpc::new(state.config.ckb_rpc_url.clone());
        let indexer_rpc = CkbRpc::new(state.config.ckb_indexer_url.clone());
        Self {
            state,
            rpc,
            indexer_rpc,
        }
    }

    pub async fn run(self) {
        info!(
            network = ?self.state.config.network,
            indexer = %self.state.config.ckb_indexer_url,
            "indexer task started"
        );

        let mut consecutive_failures: u32 = 0;
        loop {
            let delay = if consecutive_failures == 0 {
                TICK_INTERVAL_SECS
            } else {
                let backoff = TICK_INTERVAL_SECS
                    .saturating_mul(2u64.saturating_pow(consecutive_failures.min(5)));
                backoff.min(BACKOFF_MAX_SECS)
            };
            tokio::time::sleep(Duration::from_secs(delay)).await;
            match self.tick().await {
                Ok(_) => consecutive_failures = 0,
                Err(err) => {
                    consecutive_failures = consecutive_failures.saturating_add(1);
                    warn!(?err, attempt = consecutive_failures, "indexer tick failed");
                }
            }
        }
    }

    async fn tick(&self) -> anyhow::Result<()> {
        let tip = self.rpc.tip_header().await?;
        let mut cursor = db::cursor::load(&self.state.db).await?;

        if tip.number.saturating_sub(cursor) > BACKFILL_THRESHOLD {
            info!(cursor, tip = tip.number, "starting bulk backfill");
            let inserted = self.backfill().await?;
            cursor = tip.number;
            db::cursor::store(&self.state.db, cursor).await?;
            info!(inserted, cursor, "bulk backfill complete");
        }

        let target = (cursor + SCAN_BATCH).min(tip.number);

        debug!(cursor, target, tip = tip.number, "scan window");

        while cursor < target {
            let next = cursor + 1;
            let block = match self.rpc.block_by_number(next).await? {
                Some(b) => b,
                None => break,
            };

            if let Some(reorg_to) = self.detect_reorg(&block, next).await? {
                warn!(from = next, to = reorg_to, "reorg detected, rolling back");
                db::blocks::rollback(&self.state.db, reorg_to).await?;
                cursor = reorg_to.saturating_sub(1);
                db::cursor::store(&self.state.db, cursor).await?;
                continue;
            }

            self.ingest_block(next, &block).await?;
            cursor = next;
            db::cursor::store(&self.state.db, cursor).await?;
        }

        Ok(())
    }

    async fn backfill(&self) -> anyhow::Result<u64> {
        let code_hash = self.state.config.packet_lock.code_hash.clone();
        let hash_type = self.state.config.packet_lock.hash_type.clone();
        let mut cursor: Option<String> = None;
        let mut total = 0u64;
        loop {
            let (cells, next) = self
                .indexer_rpc
                .get_cells(&code_hash, &hash_type, BACKFILL_PAGE, cursor.as_deref())
                .await?;
            if cells.is_empty() {
                break;
            }
            for cell in &cells {
                if let Err(err) = self.ingest_live_cell(cell).await {
                    warn!(?err, "backfill cell ingest failed");
                }
                total += 1;
            }
            cursor = next;
            if cursor.is_none() {
                break;
            }
        }
        Ok(total)
    }

    async fn ingest_live_cell(&self, cell: &Value) -> anyhow::Result<()> {
        let tx_hash = cell
            .pointer("/out_point/tx_hash")
            .and_then(Value::as_str)
            .context("cell missing tx_hash")?;
        let idx = cell
            .pointer("/out_point/index")
            .and_then(Value::as_str)
            .and_then(|s| parse_hex_u64(s).ok())
            .unwrap_or(0);
        let block_number = cell
            .get("block_number")
            .and_then(Value::as_str)
            .and_then(|s| parse_hex_u64(s).ok())
            .unwrap_or(0);
        let capacity = cell
            .pointer("/output/capacity")
            .and_then(Value::as_str)
            .and_then(|s| parse_hex_u64(s).ok())
            .unwrap_or(0);
        let raw = cell
            .get("output_data")
            .and_then(Value::as_str)
            .unwrap_or("0x");
        let bytes = decode_hex(raw).unwrap_or_default();
        let state =
            pckt_types::PacketState::decode(&bytes).context("decode packet state from backfill")?;
        let out_point = format!("{tx_hash}:{idx}");
        db::packets::upsert(
            &self.state.db,
            db::packets::PacketRow {
                out_point: &out_point,
                state: &state,
                current_capacity: capacity,
                sealed_at: 0,
                block_number,
            },
        )
        .await?;
        Ok(())
    }

    async fn detect_reorg(&self, block: &Value, number: u64) -> anyhow::Result<Option<u64>> {
        if number == 1 {
            return Ok(None);
        }
        let parent_hash = block
            .pointer("/header/parent_hash")
            .and_then(Value::as_str)
            .context("block missing parent_hash")?;
        match db::blocks::hash_at(&self.state.db, number - 1).await? {
            Some(stored) if stored == parent_hash => Ok(None),
            Some(_) => Ok(Some(number.saturating_sub(REORG_DEPTH).max(1))),
            None => Ok(None),
        }
    }

    pub async fn process_block_for_test(
        &self,
        number: u64,
        block: &Value,
    ) -> anyhow::Result<Option<u64>> {
        if let Some(reorg_to) = self.detect_reorg(block, number).await? {
            db::blocks::rollback(&self.state.db, reorg_to).await?;
            db::cursor::store(&self.state.db, reorg_to.saturating_sub(1)).await?;
            return Ok(Some(reorg_to));
        }
        self.ingest_block(number, block).await?;
        db::cursor::store(&self.state.db, number).await?;
        Ok(None)
    }

    async fn ingest_block(&self, number: u64, block: &Value) -> anyhow::Result<()> {
        let header = block.get("header").context("block missing header")?;
        let block_hash = header
            .get("hash")
            .and_then(Value::as_str)
            .context("header missing hash")?;
        let ts = header
            .get("timestamp")
            .and_then(Value::as_str)
            .map(|s| parse_hex_u64(s).unwrap_or(0))
            .unwrap_or(0);

        db::blocks::record(&self.state.db, number, block_hash).await?;

        let txs = block
            .get("transactions")
            .and_then(Value::as_array)
            .context("block missing transactions")?;

        for tx in txs {
            let tx_hash = tx
                .get("hash")
                .and_then(Value::as_str)
                .context("tx missing hash")?;
            self.ingest_tx(tx, tx_hash, number, ts).await?;
        }
        Ok(())
    }

    async fn ingest_tx(
        &self,
        tx: &Value,
        tx_hash: &str,
        number: u64,
        ts: u64,
    ) -> anyhow::Result<()> {
        let predecessors = self.collect_predecessors(tx).await?;
        let mut new_packets = self.collect_new_packets(tx, tx_hash);
        let output_locks = self.collect_output_locks(tx);

        for pred in predecessors {
            let succ_idx = new_packets
                .iter()
                .position(|np| np.state.salt == pred.snapshot.salt);
            match succ_idx {
                Some(idx) => {
                    let succ = new_packets.remove(idx);
                    let claimer = pick_claimer(&output_locks, &pred.snapshot.owner_lock_hash);
                    self.handle_partial_claim(
                        &pred,
                        &succ,
                        claimer.as_deref(),
                        tx_hash,
                        number,
                        ts,
                    )
                    .await?;
                }
                None => {
                    let owns_output = output_locks
                        .iter()
                        .any(|h| h == &pred.snapshot.owner_lock_hash);
                    let is_reclaim = owns_output;
                    let claimer = if is_reclaim {
                        None
                    } else {
                        pick_claimer(&output_locks, &pred.snapshot.owner_lock_hash)
                    };
                    self.handle_terminal(
                        &pred,
                        is_reclaim,
                        claimer.as_deref(),
                        tx_hash,
                        number,
                        ts,
                    )
                    .await?;
                }
            }
        }

        for fresh in new_packets {
            self.handle_seal(fresh, tx_hash, number, ts).await?;
        }
        Ok(())
    }

    async fn collect_predecessors(&self, tx: &Value) -> anyhow::Result<Vec<Predecessor>> {
        let inputs = tx
            .get("inputs")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let mut out = Vec::new();
        for input in inputs {
            let prev_tx = input
                .pointer("/previous_output/tx_hash")
                .and_then(Value::as_str)
                .unwrap_or("");
            if prev_tx.is_empty() {
                continue;
            }
            let prev_idx = input
                .pointer("/previous_output/index")
                .and_then(Value::as_str)
                .and_then(|s| parse_hex_u64(s).ok())
                .unwrap_or(0);
            let out_point = format!("{prev_tx}:{prev_idx}");
            if let Some(snap) = db::packets::snapshot(&self.state.db, &out_point).await? {
                out.push(Predecessor {
                    out_point,
                    snapshot: snap,
                });
            }
        }
        Ok(out)
    }

    fn collect_new_packets(&self, tx: &Value, tx_hash: &str) -> Vec<NewPacket> {
        let outputs = tx
            .get("outputs")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let outputs_data = tx
            .get("outputs_data")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let want_code_hash = self.state.config.packet_lock.code_hash.as_str();
        let want_hash_type = self.state.config.packet_lock.hash_type.as_str();

        let mut out = Vec::new();
        for (idx, output) in outputs.iter().enumerate() {
            let lock = match output.get("lock") {
                Some(lock) => lock,
                None => continue,
            };
            let lock_code = lock.get("code_hash").and_then(Value::as_str).unwrap_or("");
            let lock_hash_type = lock.get("hash_type").and_then(Value::as_str).unwrap_or("");
            if lock_code != want_code_hash || lock_hash_type != want_hash_type {
                continue;
            }
            let raw = match outputs_data.get(idx).and_then(Value::as_str) {
                Some(s) => s,
                None => continue,
            };
            let bytes = match decode_hex(raw) {
                Some(b) => b,
                None => continue,
            };
            let state = match PacketState::decode(&bytes) {
                Some(s) => s,
                None => continue,
            };
            let capacity = output
                .get("capacity")
                .and_then(Value::as_str)
                .and_then(|s| parse_hex_u64(s).ok())
                .unwrap_or(0);
            out.push(NewPacket {
                out_point: format!("{tx_hash}:{idx}"),
                state,
                capacity,
            });
        }
        out
    }

    fn collect_output_locks(&self, tx: &Value) -> Vec<String> {
        let outputs = tx
            .get("outputs")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let want_packet = self.state.config.packet_lock.code_hash.as_str();
        let want_packet_hash_type = self.state.config.packet_lock.hash_type.as_str();
        outputs
            .iter()
            .filter_map(|o| {
                let lock = o.get("lock")?;
                let code_hex = lock.get("code_hash").and_then(Value::as_str)?;
                let hash_type_text = lock.get("hash_type").and_then(Value::as_str).unwrap_or("");
                if code_hex == want_packet && hash_type_text == want_packet_hash_type {
                    return None;
                }
                let code = decode_hex(code_hex)?;
                if code.len() != 32 {
                    return None;
                }
                let mut code_arr = [0u8; 32];
                code_arr.copy_from_slice(&code);
                let hash_type = lock
                    .get("hash_type")
                    .and_then(Value::as_str)
                    .map(hash_type_byte)
                    .unwrap_or(0);
                let args_hex = lock.get("args").and_then(Value::as_str).unwrap_or("0x");
                let args = decode_hex(args_hex).unwrap_or_default();
                Some(hex_str(&script_hash(&code_arr, hash_type, &args)))
            })
            .collect()
    }

    async fn handle_seal(
        &self,
        fresh: NewPacket,
        tx_hash: &str,
        number: u64,
        ts: u64,
    ) -> anyhow::Result<()> {
        db::packets::upsert(
            &self.state.db,
            PacketRow {
                out_point: &fresh.out_point,
                state: &fresh.state,
                current_capacity: fresh.capacity,
                sealed_at: ts,
                block_number: number,
            },
        )
        .await?;
        db::packets::record_event(
            &self.state.db,
            &fresh.out_point,
            "seal",
            tx_hash,
            number,
            ts,
            None,
            Some(&fresh.capacity.to_string()),
        )
        .await?;
        publish(
            &self.state.bus,
            PacketEventMsg {
                event_type: "seal".into(),
                out_point: fresh.out_point,
                tx_hash: tx_hash.into(),
                block_number: number,
                ts,
                claimer_lock_hash: None,
                slot_amount: Some(fresh.capacity.to_string()),
                owner_lock_hash: Some(hex_str(&fresh.state.owner_lock_hash)),
                claim_pubkey_hash: Some(hex_str(&fresh.state.claim_pubkey)),
            },
        );
        Ok(())
    }

    async fn handle_partial_claim(
        &self,
        pred: &Predecessor,
        succ: &NewPacket,
        claimer: Option<&str>,
        tx_hash: &str,
        number: u64,
        ts: u64,
    ) -> anyhow::Result<()> {
        let delta = pred.snapshot.current_capacity.saturating_sub(succ.capacity);
        db::packets::upsert(
            &self.state.db,
            PacketRow {
                out_point: &succ.out_point,
                state: &succ.state,
                current_capacity: succ.capacity,
                sealed_at: ts,
                block_number: number,
            },
        )
        .await?;
        db::packets::record_event(
            &self.state.db,
            &pred.out_point,
            "claim",
            tx_hash,
            number,
            ts,
            claimer,
            Some(&delta.to_string()),
        )
        .await?;
        publish(
            &self.state.bus,
            PacketEventMsg {
                event_type: "claim".into(),
                out_point: pred.out_point.clone(),
                tx_hash: tx_hash.into(),
                block_number: number,
                ts,
                claimer_lock_hash: claimer.map(str::to_string),
                slot_amount: Some(delta.to_string()),
                owner_lock_hash: Some(pred.snapshot.owner_lock_hash.clone()),
                claim_pubkey_hash: Some(pred.snapshot.claim_pubkey_hash.clone()),
            },
        );
        Ok(())
    }

    async fn handle_terminal(
        &self,
        pred: &Predecessor,
        is_reclaim: bool,
        claimer: Option<&str>,
        tx_hash: &str,
        number: u64,
        ts: u64,
    ) -> anyhow::Result<()> {
        let event_type = if is_reclaim { "reclaim" } else { "claim" };
        let amount = pred.snapshot.current_capacity.to_string();
        let final_slots_claimed = if is_reclaim {
            pred.snapshot.slots_claimed
        } else {
            pred.snapshot.slots_total
        };
        db::packets::mark_terminal(
            &self.state.db,
            &pred.out_point,
            final_slots_claimed,
            0,
            number,
        )
        .await?;
        db::packets::record_event(
            &self.state.db,
            &pred.out_point,
            event_type,
            tx_hash,
            number,
            ts,
            claimer,
            Some(&amount),
        )
        .await?;
        publish(
            &self.state.bus,
            PacketEventMsg {
                event_type: event_type.into(),
                out_point: pred.out_point.clone(),
                tx_hash: tx_hash.into(),
                block_number: number,
                ts,
                claimer_lock_hash: claimer.map(str::to_string),
                slot_amount: Some(amount),
                owner_lock_hash: Some(pred.snapshot.owner_lock_hash.clone()),
                claim_pubkey_hash: Some(pred.snapshot.claim_pubkey_hash.clone()),
            },
        );
        Ok(())
    }
}

fn pick_claimer(output_locks: &[String], owner_lock_hash: &str) -> Option<String> {
    output_locks
        .iter()
        .find(|h| h.as_str() != owner_lock_hash)
        .cloned()
}

fn publish(bus: &EventBus, msg: PacketEventMsg) {
    bus.publish(msg);
}

fn parse_hex_u64(s: &str) -> anyhow::Result<u64> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    u64::from_str_radix(s, 16).context("parse hex u64")
}
