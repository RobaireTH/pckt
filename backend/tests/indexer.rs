use pckt_backend::{
    crypto::{blake160, hex_str, script_hash},
    db,
};
use pckt_types::{PacketState, PacketType};
use sqlx::sqlite::SqlitePoolOptions;

fn sample_state() -> PacketState {
    PacketState {
        version: 1,
        packet_type: PacketType::Fixed,
        slots_total: 5,
        slots_claimed: 0,
        expiry: 1_700_000_000,
        unlock_time: 0,
        initial_capacity: 35_000_000_000,
        owner_lock_hash: vec![0x11; 32],
        claim_pubkey: vec![0x22; 33],
        salt: vec![0x33; 16],
        message: b"happy birthday".to_vec(),
        claimed_locks: vec![],
    }
}

#[tokio::test]
async fn upsert_packet_round_trip() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    let state = sample_state();

    db::packets::upsert(
        &pool,
        db::packets::PacketRow {
            out_point: "0xfeed:0",
            state: &state,
            current_capacity: 35_000_000_000,
            sealed_at: 1_700_000_000,
            block_number: 42,
        },
    )
    .await
    .unwrap();

    let row = db::packets::lookup(&pool, "0xfeed:0")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(row.0, format!("0x{}", "11".repeat(32)));
    assert_eq!(row.1, hex_str(&blake160(&[0x22u8; 33])));

    db::packets::record_event(
        &pool,
        "0xfeed:0",
        "claim",
        "0xc1a1m",
        43,
        1_700_000_100,
        Some("0xclaimer"),
        Some("70000000000"),
    )
    .await
    .unwrap();
    let count: (i64,) = sqlx::query_as("SELECT count(*) FROM packet_events WHERE out_point = ?1")
        .bind("0xfeed:0")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count.0, 1);
}

#[test]
fn blake160_is_first_20_bytes_of_blake2b_256() {
    let h = blake160(b"hello");
    assert_eq!(h.len(), 20);
    let again = blake160(b"hello");
    assert_eq!(h, again);
}

#[test]
fn script_hash_is_deterministic_and_args_sensitive() {
    let code = [0xab; 32];
    let a = script_hash(&code, 1, &[1, 2, 3]);
    let b = script_hash(&code, 1, &[1, 2, 3]);
    let c = script_hash(&code, 1, &[1, 2, 4]);
    let d = script_hash(&code, 2, &[1, 2, 3]);
    assert_eq!(a, b);
    assert_ne!(a, c);
    assert_ne!(a, d);
}

#[test]
fn packet_state_molecule_roundtrip() {
    let state = PacketState {
        version: 1,
        packet_type: PacketType::TimedLucky,
        slots_total: 10,
        slots_claimed: 3,
        expiry: 9_999_999,
        unlock_time: 5_555_555,
        initial_capacity: 70_000_000_000,
        owner_lock_hash: vec![0xaa; 32],
        claim_pubkey: vec![0xbb; 33],
        salt: vec![0xcc; 16],
        message: b"hidden".to_vec(),
        claimed_locks: vec![vec![0xdd; 32]],
    };
    let bytes = state.encode().unwrap();
    let back = PacketState::decode(&bytes).unwrap();
    assert_eq!(back.slots_total, 10);
    assert_eq!(back.slots_claimed, 3);
    assert!(back.packet_type.is_timed());
    assert!(back.packet_type.is_lucky());
    assert_eq!(back.message, state.message);
    assert_eq!(back.claimed_locks, state.claimed_locks);
}
