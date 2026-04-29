use molecule::prelude::*;
use pckt_schema::{Byte16, Byte32, Byte32Vec, Byte33, Bytes as MolBytes, PacketData, Uint64};
use std::env;
use std::fs;
use std::io::Write;

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

fn parse_hex32(s: &str) -> [u8; 32] {
    let s = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex_decode(s);
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes[..32]);
    out
}

fn hex_decode(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 6 {
        eprintln!(
            "usage: {} <out.bin> <packet_type:0..3> <slots_total> <expiry> <unlock_time> <initial_capacity_shannons> <owner_lock_hash_hex> <salt_hex16> [message]",
            args[0]
        );
        std::process::exit(1);
    }

    let out_path = &args[1];
    let packet_type: u8 = args[2].parse().unwrap();
    let slots_total: u8 = args[3].parse().unwrap();
    let expiry: u64 = args[4].parse().unwrap();
    let unlock_time: u64 = args[5].parse().unwrap();
    let initial_capacity: u64 = args[6].parse().unwrap();
    let owner_hex = &args[7];
    let salt_hex = &args[8];
    let msg_str = args.get(9).cloned().unwrap_or_default();

    let owner = parse_hex32(owner_hex);
    let salt_bytes = hex_decode(salt_hex.strip_prefix("0x").unwrap_or(salt_hex));
    let mut salt = [0u8; 16];
    salt.copy_from_slice(&salt_bytes[..16]);

    let claim_pubkey = [0xffu8; 33];

    let pd = PacketData::new_builder()
        .version(1u8.into())
        .packet_type(packet_type.into())
        .slots_total(slots_total.into())
        .slots_claimed(0u8.into())
        .expiry(uint64_mol(expiry))
        .unlock_time(uint64_mol(unlock_time))
        .initial_capacity(uint64_mol(initial_capacity))
        .owner_lock_hash(b32(owner))
        .claim_pubkey(b33(claim_pubkey))
        .salt(b16(salt))
        .message(mb(msg_str.as_bytes()))
        .claimed_locks(Byte32Vec::default())
        .build();

    let bytes = pd.as_slice();
    let mut f = fs::File::create(out_path).unwrap();
    f.write_all(bytes).unwrap();
    eprintln!("wrote {} bytes to {}", bytes.len(), out_path);
    println!("0x{}", hex::encode(bytes));
}
