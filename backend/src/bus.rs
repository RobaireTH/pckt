use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

const CAPACITY: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketEventMsg {
    pub event_type: String,
    pub out_point: String,
    pub tx_hash: String,
    pub block_number: u64,
    pub ts: u64,
    pub claimer_lock_hash: Option<String>,
    pub slot_amount: Option<String>,
    pub owner_lock_hash: Option<String>,
    pub claim_pubkey_hash: Option<String>,
}

#[derive(Debug, Clone)]
pub struct EventBus {
    tx: broadcast::Sender<PacketEventMsg>,
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(CAPACITY);
        Self { tx }
    }

    pub fn publish(&self, msg: PacketEventMsg) {
        let _ = self.tx.send(msg);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<PacketEventMsg> {
        self.tx.subscribe()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
