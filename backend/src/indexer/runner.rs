use std::time::Duration;

use tracing::{debug, info, warn};

use crate::{ckb::CkbRpc, state::AppState};

const TICK_INTERVAL_SECS: u64 = 30;

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
        debug!(number = tip.number, hash = %tip.hash, "ckb tip");
        Ok(())
    }
}
