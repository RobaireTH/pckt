use ckb_testtool::ckb_types::{
    bytes::Bytes,
    core::{Capacity, ScriptHashType},
    packed::{CellOutput, Script},
    prelude::*,
};
use molecule::prelude::*;
use pckt_schema::{Byte16, Byte32, Byte32Vec, Byte33, Bytes as MolBytes, PacketData, Uint64};

fn uint64_mol(v: u64) -> Uint64 {
    let bytes = v.to_le_bytes();
    Uint64::new_builder()
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

fn b32(arr: [u8; 32]) -> Byte32 {
    Byte32::new_builder().set(arr.map(Into::into)).build()
}
fn b33(arr: [u8; 33]) -> Byte33 {
    Byte33::new_builder().set(arr.map(Into::into)).build()
}
fn b16(arr: [u8; 16]) -> Byte16 {
    Byte16::new_builder().set(arr.map(Into::into)).build()
}
fn mb(src: &[u8]) -> MolBytes {
    let v: Vec<molecule::prelude::Byte> = src.iter().copied().map(Into::into).collect();
    MolBytes::new_builder().extend(v).build()
}

fn pd(slots_total: u8, slots_claimed: u8, message_len: usize) -> PacketData {
    let claimed_locks = Byte32Vec::new_builder()
        .extend((0..slots_claimed).map(|_| b32([0xff; 32])))
        .build();
    let msg = vec![0xab; message_len];
    PacketData::new_builder()
        .version(1u8.into())
        .packet_type(0u8.into())
        .slots_total(slots_total.into())
        .slots_claimed(slots_claimed.into())
        .expiry(uint64_mol(0))
        .unlock_time(uint64_mol(0))
        .initial_capacity(uint64_mol(0))
        .owner_lock_hash(b32([0xff; 32]))
        .claim_pubkey(b33([0xff; 33]))
        .salt(b16([0xff; 16]))
        .message(mb(&msg))
        .claimed_locks(claimed_locks)
        .build()
}

fn cell_floor(slots_total: u8, message_len: usize) -> u64 {
    use ckb_testtool::ckb_types::packed::Byte32 as CkbByte32;
    let salt = [0xffu8; 16];
    let code_hash = CkbByte32::new_builder()
        .set([0xff; 32].map(Into::into))
        .build();
    let lock = Script::new_builder()
        .code_hash(code_hash)
        .hash_type(ScriptHashType::Type.into())
        .args(Bytes::copy_from_slice(&salt).pack())
        .build();
    let max_live_claimed = slots_total - 1;
    let p = pd(slots_total, max_live_claimed, message_len);
    let data_cap = Capacity::bytes(p.as_slice().len()).unwrap();
    let cell = CellOutput::new_builder().lock(lock).build();
    cell.occupied_capacity(data_cap).unwrap().as_u64()
}

fn main() {
    println!(
        "{:>10} {:>10} {:>20} {:>10}",
        "slots", "msg(B)", "shannons", "CKB"
    );
    for &slots in &[5u8, 10, 16, 32, 64] {
        for &msg in &[0usize, 100, 256] {
            let s = cell_floor(slots, msg);
            println!(
                "{:>10} {:>10} {:>20} {:>10}",
                slots,
                msg,
                s,
                s / 100_000_000
            );
        }
    }
}
