use pckt_backend::{
    config::{Config, Network, PacketLock},
    db,
    indexer::Indexer,
    state::AppState,
};
use serde_json::json;
use sqlx::sqlite::SqlitePoolOptions;

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
        allowed_origins: vec!["*".into()],
        rate_limit_rps: 1000.0,
        rate_limit_burst: 1000.0,
    };
    AppState::new(pool, config)
}

fn block(number: u64, hash: &str, parent_hash: &str) -> serde_json::Value {
    json!({
        "header": {
            "number": format!("0x{number:x}"),
            "hash": hash,
            "parent_hash": parent_hash,
            "timestamp": "0x1"
        },
        "transactions": []
    })
}

#[tokio::test]
async fn reorg_rolls_back_on_parent_mismatch() {
    let state = make_state().await;
    let indexer = Indexer::new(state.clone());

    indexer
        .process_block_for_test(1, &block(1, "0xa1", "0xgenesis"))
        .await
        .unwrap();
    indexer
        .process_block_for_test(2, &block(2, "0xa2", "0xa1"))
        .await
        .unwrap();
    indexer
        .process_block_for_test(3, &block(3, "0xa3", "0xa2"))
        .await
        .unwrap();
    assert_eq!(db::cursor::load(&state.db).await.unwrap(), 3);

    let bad = block(4, "0xb4", "0xnotmatching");
    let reorg = indexer.process_block_for_test(4, &bad).await.unwrap();
    assert!(reorg.is_some(), "reorg should have triggered");

    let cursor = db::cursor::load(&state.db).await.unwrap();
    assert!(cursor < 3, "cursor should rewind, got {cursor}");
    assert!(db::blocks::hash_at(&state.db, 3).await.unwrap().is_none());
}

#[tokio::test]
async fn happy_path_no_reorg() {
    let state = make_state().await;
    let indexer = Indexer::new(state.clone());

    for n in 1..=5u64 {
        let parent = if n == 1 {
            "0xgenesis".to_string()
        } else {
            format!("0xh{}", n - 1)
        };
        let hash = format!("0xh{n}");
        let result = indexer
            .process_block_for_test(n, &block(n, &hash, &parent))
            .await
            .unwrap();
        assert!(result.is_none(), "no reorg expected at {n}");
    }
    assert_eq!(db::cursor::load(&state.db).await.unwrap(), 5);
}
