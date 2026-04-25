use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use pckt_backend::{
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
    };
    AppState::new(pool, config)
}

async fn build_app() -> Router {
    let state = build_state().await;
    routes::router().with_state(state)
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
