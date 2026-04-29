#![no_std]

extern crate alloc;

use alloc::vec::Vec;

pub use pckt_schema as schema;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

    pub fn from_byte(b: u8) -> Option<Self> {
        Some(match b {
            0 => Self::Fixed,
            1 => Self::Lucky,
            2 => Self::TimedFixed,
            3 => Self::TimedLucky,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone)]
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
    pub message: Vec<u8>,
    pub claimed_locks: Vec<Vec<u8>>,
}

impl PacketState {
    pub fn decode(bytes: &[u8]) -> Option<Self> {
        use molecule::prelude::*;
        let r = schema::PacketData::from_slice(bytes).ok()?;
        Some(Self {
            version: byte_to_u8(r.version()),
            packet_type: PacketType::from_byte(byte_to_u8(r.packet_type()))?,
            slots_total: byte_to_u8(r.slots_total()),
            slots_claimed: byte_to_u8(r.slots_claimed()),
            expiry: read_u64(&r.expiry()),
            unlock_time: read_u64(&r.unlock_time()),
            initial_capacity: read_u64(&r.initial_capacity()),
            owner_lock_hash: r.owner_lock_hash().as_slice().to_vec(),
            claim_pubkey: r.claim_pubkey().as_slice().to_vec(),
            salt: r.salt().as_slice().to_vec(),
            message: r.message().raw_data().to_vec(),
            claimed_locks: r
                .claimed_locks()
                .into_iter()
                .map(|h| h.as_slice().to_vec())
                .collect(),
        })
    }

    pub fn encode(&self) -> Option<Vec<u8>> {
        use molecule::prelude::*;
        if self.owner_lock_hash.len() != OWNER_LOCK_HASH_LEN
            || self.claim_pubkey.len() != CLAIM_PUBKEY_LEN
            || self.salt.len() != SALT_LEN
        {
            return None;
        }
        let mut owner = [0u8; OWNER_LOCK_HASH_LEN];
        owner.copy_from_slice(&self.owner_lock_hash);
        let mut pubkey = [0u8; CLAIM_PUBKEY_LEN];
        pubkey.copy_from_slice(&self.claim_pubkey);
        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&self.salt);

        let mut claimed_locks_vec = Vec::with_capacity(self.claimed_locks.len());
        for h in &self.claimed_locks {
            if h.len() != OWNER_LOCK_HASH_LEN {
                return None;
            }
            let mut buf = [0u8; OWNER_LOCK_HASH_LEN];
            buf.copy_from_slice(h);
            claimed_locks_vec.push(byte32(buf));
        }

        let pd = schema::PacketData::new_builder()
            .version(self.version.into())
            .packet_type((self.packet_type as u8).into())
            .slots_total(self.slots_total.into())
            .slots_claimed(self.slots_claimed.into())
            .expiry(uint64(self.expiry))
            .unlock_time(uint64(self.unlock_time))
            .initial_capacity(uint64(self.initial_capacity))
            .owner_lock_hash(byte32(owner))
            .claim_pubkey(byte33(pubkey))
            .salt(byte16(salt))
            .message(bytes_from(&self.message))
            .claimed_locks(
                schema::Byte32Vec::new_builder()
                    .extend(claimed_locks_vec)
                    .build(),
            )
            .build();
        Some(pd.as_slice().to_vec())
    }
}

fn bytes_from(src: &[u8]) -> schema::Bytes {
    use molecule::prelude::*;
    let v: Vec<molecule::prelude::Byte> = src.iter().copied().map(Into::into).collect();
    schema::Bytes::new_builder().extend(v).build()
}

fn byte_to_u8(b: molecule::prelude::Byte) -> u8 {
    b.as_slice()[0]
}

fn read_u64(u: &schema::Uint64) -> u64 {
    use molecule::prelude::*;
    let s = u.as_slice();
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&s[..8]);
    u64::from_le_bytes(buf)
}

fn uint64(v: u64) -> schema::Uint64 {
    use molecule::prelude::*;
    let bytes = v.to_le_bytes();
    schema::Uint64::new_builder()
        .set([
            bytes[0].into(),
            bytes[1].into(),
            bytes[2].into(),
            bytes[3].into(),
            bytes[4].into(),
            bytes[5].into(),
            bytes[6].into(),
            bytes[7].into(),
        ])
        .build()
}

fn byte32(arr: [u8; 32]) -> schema::Byte32 {
    use molecule::prelude::*;
    schema::Byte32::new_builder()
        .set(arr.map(Into::into))
        .build()
}

fn byte33(arr: [u8; 33]) -> schema::Byte33 {
    use molecule::prelude::*;
    schema::Byte33::new_builder()
        .set(arr.map(Into::into))
        .build()
}

fn byte16(arr: [u8; 16]) -> schema::Byte16 {
    use molecule::prelude::*;
    schema::Byte16::new_builder()
        .set(arr.map(Into::into))
        .build()
}

pub const OWNER_LOCK_HASH_LEN: usize = 32;
pub const CLAIM_PUBKEY_LEN: usize = 33;
pub const SALT_LEN: usize = 16;
pub const MESSAGE_HASH_LEN: usize = 20;

pub const PACKET_STATE_VERSION: u8 = 1;
pub const SLOT_FLOOR_SHANNONS: u64 = 7_000_000_000;
pub const MIN_SLOT_SHANNONS: u64 = 100_000_000;
pub const MAX_MESSAGE_LEN: usize = 256;
pub const MAX_SLOTS: u8 = 64;

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> PacketState {
        PacketState {
            version: 1,
            packet_type: PacketType::TimedLucky,
            slots_total: 5,
            slots_claimed: 2,
            expiry: 9_999_999,
            unlock_time: 1_111_111,
            initial_capacity: 50_000_000_000,
            owner_lock_hash: alloc::vec![0xaa; 32],
            claim_pubkey: alloc::vec![0xbb; 33],
            salt: alloc::vec![0xcc; 16],
            message: b"hello pckt".to_vec(),
            claimed_locks: alloc::vec![alloc::vec![0xdd; 32], alloc::vec![0xee; 32]],
        }
    }

    #[test]
    fn molecule_roundtrip() {
        let s = sample();
        let bytes = s.encode().expect("encode");
        let back = PacketState::decode(&bytes).expect("decode");
        assert_eq!(back.version, s.version);
        assert_eq!(back.packet_type, s.packet_type);
        assert_eq!(back.slots_total, s.slots_total);
        assert_eq!(back.slots_claimed, s.slots_claimed);
        assert_eq!(back.expiry, s.expiry);
        assert_eq!(back.unlock_time, s.unlock_time);
        assert_eq!(back.initial_capacity, s.initial_capacity);
        assert_eq!(back.owner_lock_hash, s.owner_lock_hash);
        assert_eq!(back.claim_pubkey, s.claim_pubkey);
        assert_eq!(back.salt, s.salt);
        assert_eq!(back.message, s.message);
        assert_eq!(back.claimed_locks, s.claimed_locks);
    }
}
