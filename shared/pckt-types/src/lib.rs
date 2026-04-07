use serde::{Deserialize, Serialize};

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PacketType {
    Fixed = 0,
    Lucky = 1,
    TimedFixed = 2,
    TimedLucky = 3,
}

impl PacketType {
    pub fn is_timed(self) -> bool {
        matches!(self, Self::TimedFixed | Self::TimedLucky)
    }

    pub fn is_lucky(self) -> bool {
        matches!(self, Self::Lucky | Self::TimedLucky)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketState {
    pub version: u8,
    pub packet_type: PacketType,
    pub slots_total: u8,
    pub slots_claimed: u8,
    pub expiry: u64,
    pub unlock_time: u64,
    pub initial_capacity: u64,
    pub owner_lock_hash: Vec<u8>,
    pub claim_pubkey: Vec<u8>,
    pub salt: Vec<u8>,
    pub message_hash: Vec<u8>,
}

pub const OWNER_LOCK_HASH_LEN: usize = 32;
pub const CLAIM_PUBKEY_LEN: usize = 33;
pub const SALT_LEN: usize = 16;
pub const MESSAGE_HASH_LEN: usize = 20;

pub const PACKET_STATE_VERSION: u8 = 1;

pub const SLOT_FLOOR_SHANNONS: u64 = 7_000_000_000;
