use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use pckt_backend::{
    bus::PacketEventMsg,
    config::{Config, Network, PacketLock},
    db, routes,
    state::AppState,
};
use sqlx::sqlite::SqlitePoolOptions;
use tower::ServiceExt;

async fn build_state() -> AppState {
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
            code_hash: "0x00".into(),
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

async fn build_state_with_limit(rps: f64, burst: f64) -> AppState {
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
            code_hash: "0x00".into(),
            hash_type: "data1".into(),
            out_point_tx: "0x00".into(),
            out_point_index: 0,
        },
        allowed_origins: vec!["*".into()],
        rate_limit_rps: rps,
        rate_limit_burst: burst,
    };
    AppState::new(pool, config)
}

async fn build_app() -> Router {
    let state = build_state().await;
    routes::router(&state).with_state(state)
}

async fn body_string(resp: axum::response::Response) -> String {
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    String::from_utf8(bytes.to_vec()).unwrap()
}

#[tokio::test]
async fn healthz_returns_ok() {
    let app = build_app().await;
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_string(resp).await;
    assert!(body.contains("\"ok\":true"), "body = {body}");
}

#[tokio::test]
async fn empty_packets_list() {
    let app = build_app().await;
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/packets")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_string(resp).await, "[]");
}

#[tokio::test]
async fn sender_profile_store_and_fetch() {
    let app = build_app().await;

    let save = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/profiles")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"owner_lock_hash":"0xowner","sender_address":"ckt1qexample","username":"shen.bit"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(save.status(), StatusCode::OK);

    let fetch = app
        .oneshot(
            Request::builder()
                .uri("/v1/profiles/0xowner")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(fetch.status(), StatusCode::OK);
    let body = body_string(fetch).await;
    assert!(body.contains("\"username\":\"shen.bit\""), "body = {body}");
}

#[tokio::test]
async fn claimed_packets_list_filters_by_claimer() {
    let state = build_state().await;

    sqlx::query(
        r#"
        INSERT INTO packets (
            out_point, packet_type, slots_total, slots_claimed,
            initial_capacity, current_capacity, expiry, unlock_time,
            owner_lock_hash, claim_pubkey_hash, salt, message_hash,
            message_body, sealed_at, last_seen_block
        ) VALUES
            ('0xaaa:0', 0, 5, 1, '100', '90', 1000, 0, '0xowner-a', '0xpub-a', x'01', x'01', 'hello', 100, 1),
            ('0xbbb:0', 1, 5, 2, '200', '120', 2000, 0, '0xowner-b', '0xpub-b', x'02', x'02', 'world', 200, 2)
        "#
    )
    .execute(&state.db)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO packet_events (
            out_point, event_type, tx_hash, block_number, ts, claimer_lock_hash, slot_amount
        ) VALUES
            ('0xaaa:0', 'claim', '0xtx1', 10, 100, '0xclaimer', '20'),
            ('0xbbb:0', 'claim', '0xtx2', 11, 101, '0xsomeone-else', '30')
        "#,
    )
    .execute(&state.db)
    .await
    .unwrap();

    let app = routes::router(&state).with_state(state);
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/packets/claimed?claimer=0xclaimer")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_string(resp).await;
    assert!(body.contains("\"out_point\":\"0xaaa:0\""), "body = {body}");
    assert!(body.contains("\"message_body\":\"hello\""), "body = {body}");
    assert!(body.contains("\"slot_amount\":\"20\""), "body = {body}");
    assert!(!body.contains("\"out_point\":\"0xbbb:0\""), "body = {body}");
}

#[tokio::test]
async fn packets_list_collapses_successor_versions() {
    let state = build_state().await;

    sqlx::query(
        r#"
        INSERT INTO packets (
            out_point, packet_type, slots_total, slots_claimed,
            initial_capacity, current_capacity, expiry, unlock_time,
            owner_lock_hash, claim_pubkey_hash, salt, message_hash,
            message_body, sealed_at, last_seen_block
        ) VALUES
            ('0xolder:0', 0, 10, 0, '15000000000000', '15058000000000', 1000, 0, '0xowner', '0xpub', x'01', x'01', 'gm', 100, 10),
            ('0xnewer:0', 0, 10, 1, '15000000000000', '13558000000000', 1000, 0, '0xowner', '0xpub', x'01', x'01', 'gm', 100, 11)
        "#
    )
    .execute(&state.db)
    .await
    .unwrap();

    let app = routes::router(&state).with_state(state);
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/packets?owner=0xowner")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_string(resp).await;
    assert!(
        body.contains("\"out_point\":\"0xnewer:0\""),
        "body = {body}"
    );
    assert!(body.contains("\"slots_claimed\":1"), "body = {body}");
    assert!(
        !body.contains("\"out_point\":\"0xolder:0\""),
        "body = {body}"
    );
}

#[tokio::test]
async fn missing_packet_404() {
    let app = build_app().await;
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/packets/0xabc")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn shortlink_create_and_redirect() {
    let app = build_app().await;
    let create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/links")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"full_url":"https://example.com"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create.status(), StatusCode::OK);
    let body = body_string(create).await;
    let slug_start = body.find("\"slug\":\"").unwrap() + 8;
    let slug_end = body[slug_start..].find('"').unwrap() + slug_start;
    let slug = &body[slug_start..slug_end];

    let redirect = app
        .oneshot(
            Request::builder()
                .uri(format!("/l/{slug}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(redirect.status(), StatusCode::SEE_OTHER);
    assert_eq!(
        redirect.headers().get("location").unwrap(),
        "https://example.com"
    );
}

#[tokio::test]
async fn messages_store_and_fetch() {
    let app = build_app().await;
    let hash = format!("0x{}", "ab".repeat(20));
    let payload = format!(r#"{{"message_hash":"{hash}","body":"hello world"}}"#);

    let store = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/messages")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(store.status(), StatusCode::OK);

    let fetch = app
        .oneshot(
            Request::builder()
                .uri(format!("/v1/messages/{hash}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(fetch.status(), StatusCode::OK);
    let body = body_string(fetch).await;
    assert!(body.contains("\"body\":\"hello world\""), "body = {body}");
}

#[tokio::test]
async fn messages_reject_bad_hash() {
    let app = build_app().await;
    let resp = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/messages")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"message_hash":"nothex","body":"x"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn relay_rejects_non_object() {
    let app = build_app().await;
    let resp = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/relay/tx")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"signed_tx":"nope"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn cursor_roundtrip() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    assert_eq!(db::cursor::load(&pool).await.unwrap(), 0);
    db::cursor::store(&pool, 42).await.unwrap();
    assert_eq!(db::cursor::load(&pool).await.unwrap(), 42);
    db::cursor::store(&pool, 100).await.unwrap();
    assert_eq!(db::cursor::load(&pool).await.unwrap(), 100);
}

#[tokio::test]
async fn sse_publishes_event() {
    let state = build_state().await;
    let app = routes::router(&state).with_state(state.clone());

    let bus = state.bus.clone();
    let pump = tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        bus.publish(PacketEventMsg {
            event_type: "seal".into(),
            out_point: "0xabc:0".into(),
            tx_hash: "0xtx".into(),
            block_number: 7,
            ts: 100,
            claimer_lock_hash: None,
            slot_amount: Some("100".into()),
            owner_lock_hash: Some("0xowner".into()),
            claim_pubkey_hash: Some("0xpub".into()),
        });
    });

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/events/stream")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers().get("content-type").unwrap(),
        "text/event-stream"
    );

    let mut body = resp.into_body();
    let frame = tokio::time::timeout(std::time::Duration::from_secs(2), async {
        loop {
            match body.frame().await {
                Some(Ok(f)) => {
                    if let Ok(data) = f.into_data() {
                        let s = String::from_utf8_lossy(&data).to_string();
                        if s.contains("0xabc:0") {
                            return s;
                        }
                    }
                }
                Some(Err(_)) | None => return String::new(),
            }
        }
    })
    .await
    .unwrap();
    pump.await.unwrap();
    assert!(frame.contains("event: seal"), "frame = {frame}");
    assert!(frame.contains("\"out_point\":\"0xabc:0\""));
}

#[tokio::test]
async fn block_hashes_record_and_rollback() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    db::blocks::record(&pool, 1, "0xaaa").await.unwrap();
    db::blocks::record(&pool, 2, "0xbbb").await.unwrap();
    assert_eq!(
        db::blocks::hash_at(&pool, 2).await.unwrap().as_deref(),
        Some("0xbbb")
    );
    db::blocks::rollback(&pool, 2).await.unwrap();
    assert!(db::blocks::hash_at(&pool, 2).await.unwrap().is_none());
    assert_eq!(
        db::blocks::hash_at(&pool, 1).await.unwrap().as_deref(),
        Some("0xaaa")
    );
}

#[tokio::test]
async fn rate_limit_returns_429_after_burst() {
    let state = build_state_with_limit(0.5, 2.0).await;
    let app = routes::router(&state).with_state(state);

    let make_req = || {
        Request::builder()
            .method("POST")
            .uri("/v1/links")
            .header("content-type", "application/json")
            .header("x-forwarded-for", "192.0.2.1")
            .body(Body::from(r#"{"full_url":"https://example.com"}"#))
            .unwrap()
    };

    let r1 = app.clone().oneshot(make_req()).await.unwrap();
    assert_eq!(r1.status(), StatusCode::OK);
    let r2 = app.clone().oneshot(make_req()).await.unwrap();
    assert_eq!(r2.status(), StatusCode::OK);
    let r3 = app.oneshot(make_req()).await.unwrap();
    assert_eq!(r3.status(), StatusCode::TOO_MANY_REQUESTS);
}
