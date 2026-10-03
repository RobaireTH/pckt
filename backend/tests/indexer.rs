use pckt_backend::{
    config::{Config, Network, PacketLock},
    crypto::{blake160, hex_str, script_hash},
    db,
    indexer::{self, Indexer},
    state::AppState,
};
use pckt_types::{PacketState, PacketType};
use serde_json::json;
use sqlx::sqlite::SqlitePoolOptions;

use molecule::prelude::{Builder, Entity};
use pckt_types::schema::{Byte32, Byte65, Claim, PacketAction, PacketWitness, Reclaim};

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

async fn make_state() -> AppState {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    let config = Config {
        network: Network::Devnet,
        ckb_rpc_url: "http://127.0.0.1:0".into(),
        ckb_indexer_url: "http://127.0.0.1:0".into(),
        database_url: "sqlite::memory:".into(),
        port: 0,
        price_feed_url: "http://127.0.0.1:0".into(),
        shortlink_base: "http://example.test".into(),
        packet_lock: PacketLock {
            code_hash: "0xpacket".into(),
            hash_type: "data1".into(),
            out_point_tx: "0x00".into(),
            out_point_index: 0,
        },
        shortlink_allowed_hosts: vec!["example.test".into()],
        allowed_origins: vec!["*".into()],
        rate_limit_rps: 1000.0,
        rate_limit_burst: 1000.0,
        trust_forwarded_for: false,
    };
    AppState::new(pool, config)
}

fn byte32(arr: [u8; 32]) -> Byte32 {
    Byte32::new_builder().set(arr.map(Into::into)).build()
}

fn byte65(arr: [u8; 65]) -> Byte65 {
    Byte65::new_builder().set(arr.map(Into::into)).build()
}

fn claim_witness_args(claimer_lock_hash: [u8; 32]) -> Vec<u8> {
    let claim = Claim::new_builder()
        .signature(byte65([0x44; 65]))
        .claimer_lock_hash(byte32(claimer_lock_hash))
        .build();
    let action = PacketAction::new_builder().set(claim).build();
    let packet_witness = PacketWitness::new_builder().action(action).build();
    witness_args_with_lock(packet_witness.as_slice())
}

fn reclaim_witness_args() -> Vec<u8> {
    let action = PacketAction::new_builder()
        .set(Reclaim::new_builder().build())
        .build();
    let packet_witness = PacketWitness::new_builder().action(action).build();
    witness_args_with_lock(packet_witness.as_slice())
}

const OWNER_CODE_HASH: [u8; 32] = [0x99; 32];

fn owner_lock_hash() -> [u8; 32] {
    script_hash(&OWNER_CODE_HASH, 1, &[0x11])
}

fn owner_output(capacity: &str) -> serde_json::Value {
    json!({
        "capacity": capacity,
        "lock": { "code_hash": hex_str(&OWNER_CODE_HASH), "hash_type": "type", "args": "0x11" },
        "type": null
    })
}

async fn seed_packet(state: &AppState, out_point: &str, packet: &PacketState) {
    db::packets::upsert(
        &state.db,
        db::packets::PacketRow {
            out_point,
            state: packet,
            current_capacity: 35_000_000_000,
            sealed_at: 1,
            block_number: 1,
        },
    )
    .await
    .unwrap();
}

async fn events_for(state: &AppState, out_point: &str) -> Vec<(String, Option<String>)> {
    sqlx::query_as(
        "SELECT event_type, claimer_lock_hash FROM packet_events WHERE out_point = ?1 ORDER BY id",
    )
    .bind(out_point)
    .fetch_all(&state.db)
    .await
    .unwrap()
}

fn block_with_tx(tx: serde_json::Value) -> serde_json::Value {
    json!({
        "header": {
            "number": "0x2",
            "hash": "0xblock2",
            "parent_hash": "0xgenesis",
            "timestamp": "0x65"
        },
        "transactions": [tx]
    })
}

fn witness_args_with_lock(lock: &[u8]) -> Vec<u8> {
    let lock_offset = 16u32;
    let input_type_offset = lock_offset + 4 + lock.len() as u32;
    let output_type_offset = input_type_offset;
    let mut out = Vec::new();
    out.extend_from_slice(&lock_offset.to_le_bytes());
    out.extend_from_slice(&input_type_offset.to_le_bytes());
    out.extend_from_slice(&output_type_offset.to_le_bytes());
    out.extend_from_slice(&output_type_offset.to_le_bytes());
    out.extend_from_slice(&(lock.len() as u32).to_le_bytes());
    out.extend_from_slice(lock);
    out
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
fn claim_witness_args_yield_the_declared_claimer_lock_hash() {
    let claimer = [0x77; 32];
    let witness = claim_witness_args(claimer);

    let decoded = indexer::claim::claimer_from_witness_args(&witness).expect("claim witness");

    assert_eq!(decoded, format!("0x{}", "77".repeat(32)));
}

#[tokio::test]
async fn claim_badges_round_trip_by_claim_event() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    db::claim_badges::record(
        &pool,
        db::claim_badges::ClaimBadgeRow {
            out_point: "0xbadge:2",
            packet_out_point: "0xpacket:0",
            claim_tx_hash: "0xclaim",
            block_number: 100,
            ts: 1_700_000_000,
            owner_lock_hash: "0xowner",
            claimer_lock_hash: "0xclaimer",
            claim_pubkey_hash: "0xpub",
            scope_id: "pckt:0xpub",
            slot_index: 1,
            slot_amount: Some("70000000000"),
            metadata_json: r#"{"protocol":"ckb-pop","proof_type":"pckt-claim"}"#,
        },
    )
    .await
    .unwrap();

    let badge = db::claim_badges::find_for_claim(&pool, "0xpacket:0", "0xclaim", "0xclaimer")
        .await
        .unwrap()
        .expect("claim badge");

    assert_eq!(badge.out_point, "0xbadge:2");
    assert_eq!(badge.scope_id, "pckt:0xpub");
    assert_eq!(badge.slot_index, 1);
}

#[tokio::test]
async fn indexer_records_claim_badge_from_claim_transaction() {
    let state = make_state().await;
    let indexer = Indexer::new(state.clone());
    let pred = sample_state();
    let claimer_lock_hash = format!("0x{}", "77".repeat(32));

    db::packets::upsert(
        &state.db,
        db::packets::PacketRow {
            out_point: "0xprev:0",
            state: &pred,
            current_capacity: 35_000_000_000,
            sealed_at: 1,
            block_number: 1,
        },
    )
    .await
    .unwrap();

    let mut succ = pred.clone();
    succ.slots_claimed = 1;
    succ.claimed_locks.push(vec![0x77; 32]);
    let succ_data = hex_str(&succ.encode().unwrap());
    let witness = hex_str(&claim_witness_args([0x77; 32]));

    let block = json!({
        "header": {
            "number": "0x2",
            "hash": "0xblock2",
            "parent_hash": "0xgenesis",
            "timestamp": "0x65"
        },
        "transactions": [{
            "hash": "0xclaimtx",
            "inputs": [{
                "previous_output": { "tx_hash": "0xprev", "index": "0x0" }
            }],
            "outputs": [
                {
                    "capacity": "0x6d14d9c00",
                    "lock": { "code_hash": "0xpacket", "hash_type": "data1", "args": "0x01" },
                    "type": null
                },
                {
                    "capacity": "0x5f5e100",
                    "lock": { "code_hash": "0x1111111111111111111111111111111111111111111111111111111111111111", "hash_type": "type", "args": "0x77" },
                    "type": null
                },
                {
                    "capacity": "0x5f5e100",
                    "lock": { "code_hash": "0x2222222222222222222222222222222222222222222222222222222222222222", "hash_type": "type", "args": "0x77" },
                    "type": {
                        "code_hash": "0x3333333333333333333333333333333333333333333333333333333333333333",
                        "hash_type": "type",
                        "args": "0x0102"
                    }
                }
            ],
            "outputs_data": [
                succ_data,
                "0x",
                "0x7b2270726f746f636f6c223a22636b622d706f70222c2270726f6f665f74797065223a2270636b742d636c61696d227d"
            ],
            "witnesses": [witness]
        }]
    });

    indexer.process_block_for_test(2, &block).await.unwrap();

    let badge =
        db::claim_badges::find_for_claim(&state.db, "0xprev:0", "0xclaimtx", &claimer_lock_hash)
            .await
            .unwrap()
            .expect("claim badge");
    assert_eq!(badge.out_point, "0xclaimtx:2");
    assert_eq!(badge.slot_index, 1);
    assert_eq!(
        badge.scope_id,
        format!("pckt:{}", hex_str(&blake160(&[0x22; 33])))
    );
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

fn seal_block(
    tx_hash: &str,
    state: &PacketState,
    args: &str,
    capacity: u64,
    typed: bool,
) -> serde_json::Value {
    let type_script = if typed {
        json!({ "code_hash": "0x3333333333333333333333333333333333333333333333333333333333333333", "hash_type": "type", "args": "0x" })
    } else {
        serde_json::Value::Null
    };
    json!({
        "header": {
            "number": "0x2",
            "hash": "0xblock2",
            "parent_hash": "0xgenesis",
            "timestamp": "0x65"
        },
        "transactions": [{
            "hash": tx_hash,
            "inputs": [],
            "outputs": [{
                "capacity": format!("0x{capacity:x}"),
                "lock": { "code_hash": "0xpacket", "hash_type": "data1", "args": args },
                "type": type_script
            }],
            "outputs_data": [hex_str(&state.encode().unwrap())],
            "witnesses": []
        }]
    })
}

async fn sealed_count(state: &AppState) -> i64 {
    let row: (i64,) = sqlx::query_as("SELECT count(*) FROM packets")
        .fetch_one(&state.db)
        .await
        .unwrap();
    row.0
}

fn seal_capacity(state: &PacketState) -> u64 {
    state.initial_capacity + indexer::packet_floor(state.slots_total, state.message.len())
}

#[tokio::test]
async fn indexer_accepts_well_formed_seal() {
    let app = make_state().await;
    let indexer = Indexer::new(app.clone());
    let packet = sample_state();
    let args = hex_str(&blake160(&packet.claim_pubkey));
    let block = seal_block("0xseal", &packet, &args, seal_capacity(&packet), false);
    indexer.process_block_for_test(2, &block).await.unwrap();
    assert_eq!(sealed_count(&app).await, 1);
}

#[tokio::test]
async fn indexer_skips_spoofed_seals() {
    let packet = sample_state();
    let good_args = hex_str(&blake160(&packet.claim_pubkey));
    let mut claimed = packet.clone();
    claimed.slots_claimed = 5;
    claimed.claimed_locks = vec![vec![0x99; 32]; 5];

    let cases = vec![
        (
            "wrong lock args",
            seal_block("0xa", &packet, "0x01", seal_capacity(&packet), false),
        ),
        (
            "type script",
            seal_block("0xb", &packet, &good_args, seal_capacity(&packet), true),
        ),
        (
            "under capacity",
            seal_block("0xc", &packet, &good_args, packet.initial_capacity, false),
        ),
        (
            "already claimed",
            seal_block("0xd", &claimed, &good_args, seal_capacity(&packet), false),
        ),
    ];
    for (name, block) in cases {
        let app = make_state().await;
        let indexer = Indexer::new(app.clone());
        indexer.process_block_for_test(2, &block).await.unwrap();
        assert_eq!(sealed_count(&app).await, 0, "{name} must not be indexed");
    }
}

#[tokio::test]
async fn indexer_reads_claimer_from_packet_input_witness() {
    let state = make_state().await;
    let indexer = Indexer::new(state.clone());
    let pred = sample_state();
    seed_packet(&state, "0xprev:0", &pred).await;

    let mut succ = pred.clone();
    succ.slots_claimed = 1;
    succ.claimed_locks.push(vec![0x77; 32]);

    let tx = json!({
        "hash": "0xclaimtx",
        "inputs": [
            { "previous_output": { "tx_hash": "0xfunding", "index": "0x0" } },
            { "previous_output": { "tx_hash": "0xprev", "index": "0x0" } }
        ],
        "outputs": [
            {
                "capacity": "0x5f5e100",
                "lock": { "code_hash": hex_str(&[0x55; 32]), "hash_type": "type", "args": "0x55" },
                "type": null
            },
            {
                "capacity": "0x6d14d9c00",
                "lock": { "code_hash": "0xpacket", "hash_type": "data1", "args": "0x01" },
                "type": null
            }
        ],
        "outputs_data": ["0x", hex_str(&succ.encode().unwrap())],
        "witnesses": ["0x", hex_str(&claim_witness_args([0x77; 32]))]
    });
    indexer
        .process_block_for_test(2, &block_with_tx(tx))
        .await
        .unwrap();

    assert_eq!(
        events_for(&state, "0xprev:0").await,
        vec![("claim".to_string(), Some(format!("0x{}", "77".repeat(32))))]
    );
}

#[tokio::test]
async fn owner_claiming_last_slot_is_recorded_as_claim() {
    let state = make_state().await;
    let indexer = Indexer::new(state.clone());
    let mut pred = sample_state();
    pred.owner_lock_hash = owner_lock_hash().to_vec();
    pred.slots_claimed = 4;
    seed_packet(&state, "0xprev:0", &pred).await;

    let tx = json!({
        "hash": "0xlastclaim",
        "inputs": [{ "previous_output": { "tx_hash": "0xprev", "index": "0x0" } }],
        "outputs": [owner_output("0x826299e00")],
        "outputs_data": ["0x"],
        "witnesses": [hex_str(&claim_witness_args(owner_lock_hash()))]
    });
    indexer
        .process_block_for_test(2, &block_with_tx(tx))
        .await
        .unwrap();

    assert_eq!(
        events_for(&state, "0xprev:0").await,
        vec![("claim".to_string(), Some(hex_str(&owner_lock_hash())))]
    );
}

#[tokio::test]
async fn reclaim_witness_is_recorded_as_reclaim() {
    let state = make_state().await;
    let indexer = Indexer::new(state.clone());
    let mut pred = sample_state();
    pred.owner_lock_hash = owner_lock_hash().to_vec();
    pred.slots_claimed = 2;
    seed_packet(&state, "0xprev:0", &pred).await;

    let tx = json!({
        "hash": "0xreclaim",
        "inputs": [
            { "previous_output": { "tx_hash": "0xownercell", "index": "0x0" } },
            { "previous_output": { "tx_hash": "0xprev", "index": "0x0" } }
        ],
        "outputs": [owner_output("0x826299e00")],
        "outputs_data": ["0x"],
        "witnesses": ["0x", hex_str(&reclaim_witness_args())]
    });
    indexer
        .process_block_for_test(2, &block_with_tx(tx))
        .await
        .unwrap();

    assert_eq!(
        events_for(&state, "0xprev:0").await,
        vec![("reclaim".to_string(), None)]
    );
}
