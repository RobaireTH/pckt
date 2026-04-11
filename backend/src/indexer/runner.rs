use std::time::Duration;

use tracing::{debug, info, warn};

use crate::{ckb::CkbRpc, db, state::AppState};

const TICK_INTERVAL_SECS: u64 = 30;
const SCAN_BATCH: u64 = 64;

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
            match self.rpc.block_by_number(next).await? {
                Some(_block) => debug!(block = next, "block fetched"),
                None => break,
            }
            cursor = next;
            db::cursor::store(&self.state.db, cursor).await?;
        }

        Ok(())
    }
}
