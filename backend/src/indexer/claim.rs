use anyhow::{Context, Result};
use molecule::prelude::Entity;
use pckt_types::schema::{PacketActionUnion, PacketWitness};

use crate::crypto::hex_str;

pub fn claimer_from_witness_args(bytes: &[u8]) -> Result<String> {
    let lock = witness_lock_field(bytes).context("missing packet lock witness")?;
    let packet_witness = PacketWitness::from_slice(lock)
        .map_err(|err| anyhow::anyhow!("decode packet witness: {err:?}"))?;
    match packet_witness.action().to_enum() {
        PacketActionUnion::Claim(claim) => Ok(hex_str(claim.claimer_lock_hash().as_slice())),
        PacketActionUnion::Reclaim(_) => anyhow::bail!("packet witness is reclaim"),
    }
}

fn witness_lock_field(bytes: &[u8]) -> Option<&[u8]> {
    if bytes.len() < 16 {
        return None;
    }
    let field_count = read_u32(bytes, 0)? as usize / 4;
    if field_count < 1 {
        return None;
    }
    let lock_offset = read_u32(bytes, 0)? as usize;
    let next_offset = if field_count > 1 {
        read_u32(bytes, 4)? as usize
    } else {
        bytes.len()
    };
    if lock_offset == next_offset {
        return None;
    }
    if lock_offset + 4 > bytes.len() || next_offset > bytes.len() || lock_offset >= next_offset {
        return None;
    }
    let item_len = read_u32(bytes, lock_offset)? as usize;
    let item_start = lock_offset.checked_add(4)?;
    let item_end = item_start.checked_add(item_len)?;
    if item_end > next_offset || item_end > bytes.len() {
        return None;
    }
    Some(&bytes[item_start..item_end])
}

fn read_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    let end = offset.checked_add(4)?;
    let slice = bytes.get(offset..end)?;
    let mut buf = [0u8; 4];
    buf.copy_from_slice(slice);
    Some(u32::from_le_bytes(buf))
}
