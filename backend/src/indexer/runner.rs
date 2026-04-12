use std::time::Duration;

use anyhow::Context;
use serde_json::Value;
use tracing::{debug, info, warn};

use crate::{ckb::CkbRpc, db, state::AppState};

const TICK_INTERVAL_SECS: u64 = 30;
const SCAN_BATCH: u64 = 64;
const REORG_DEPTH: u64 = 50;

pub struct Indexer {
    state: AppState,
    rpc: CkbRpc,
}

impl Indexer {
    pub fn new(state: AppState) -> Self {
        let rpc = CkbRpc::new(state.config.ckb_rpc_url.clone());
        Self { state, rpc }
    }

    pub async fn run(self) {
        info!(
            network = ?self.state.config.network,
            indexer = %self.state.config.ckb_indexer_url,
            "indexer task started"
        );

        let mut interval = tokio::time::interval(Duration::from_secs(TICK_INTERVAL_SECS));
        loop {
            interval.tick().await;
            if let Err(err) = self.tick().await {
                warn!(?err, "indexer tick failed");
            }
        }
    }

    async fn tick(&self) -> anyhow::Result<()> {
        let tip = self.rpc.tip_header().await?;
        let mut cursor = db::cursor::load(&self.state.db).await?;
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

            let block_hash = block
                .pointer("/header/hash")
                .and_then(Value::as_str)
                .context("block missing hash")?;
            db::blocks::record(&self.state.db, next, block_hash).await?;

            cursor = next;
            db::cursor::store(&self.state.db, cursor).await?;
        }

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
}
