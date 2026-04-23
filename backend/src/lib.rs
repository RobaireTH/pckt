pub mod bus;
pub mod ckb;
pub mod config;
pub mod crypto;
pub mod db;
pub mod error;
pub mod indexer;
pub mod routes;
pub mod state;

use std::net::SocketAddr;

use anyhow::Context;
use axum::http::{HeaderName, HeaderValue, Method, Request};
use tokio::net::TcpListener;
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestId, PropagateRequestIdLayer, RequestId, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing::info;

use crate::{config::Config, indexer::Indexer, state::AppState};

pub async fn run(config: Config) -> anyhow::Result<()> {
    let pool = db::connect(&config.database_url).await?;
    db::migrate(&pool).await?;

    let state = AppState::new(pool, config);

    let indexer = Indexer::new(state.clone());
    let indexer_handle = tokio::spawn(async move { indexer.run().await });
    let sweeper_state = state.clone();
    let sweeper_handle = tokio::spawn(async move { run_shortlink_sweeper(sweeper_state).await });

    let request_id_header = HeaderName::from_static("x-request-id");
    let app = routes::router()
        .layer(PropagateRequestIdLayer::new(request_id_header.clone()))
        .layer(
            TraceLayer::new_for_http().make_span_with(|req: &Request<_>| {
                let id = req
                    .headers()
                    .get("x-request-id")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("-");
                tracing::info_span!(
                    "http",
                    request_id = id,
                    method = %req.method(),
                    uri = %req.uri()
                )
            }),
        )
        .layer(SetRequestIdLayer::new(request_id_header, UuidRequestId))
        .layer(cors_layer(&state.config.allowed_origins))
        .with_state(state.clone());

    let addr: SocketAddr = ([0, 0, 0, 0], state.config.port).into();
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    info!(%addr, "pckt-backend listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    indexer_handle.abort();
    sweeper_handle.abort();
    info!("pckt-backend shutdown complete");
    Ok(())
}

async fn run_shortlink_sweeper(state: AppState) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
    loop {
        interval.tick().await;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        match db::shortlinks::purge_expired(&state.db, now).await {
            Ok(n) if n > 0 => info!(removed = n, "expired shortlinks swept"),
            Ok(_) => {}
            Err(err) => tracing::warn!(?err, "shortlink sweep failed"),
        }
    }
}

#[derive(Clone, Default)]
struct UuidRequestId;

impl MakeRequestId for UuidRequestId {
    fn make_request_id<B>(&mut self, _req: &Request<B>) -> Option<RequestId> {
        let id = uuid::Uuid::new_v4().to_string();
        HeaderValue::from_str(&id).ok().map(RequestId::new)
    }
}

fn cors_layer(allowed: &[String]) -> CorsLayer {
    let methods = [Method::GET, Method::POST, Method::OPTIONS];
    if allowed.iter().any(|s| s == "*") || allowed.is_empty() {
        return CorsLayer::new()
            .allow_origin(tower_http::cors::Any)
            .allow_methods(methods)
            .allow_headers(tower_http::cors::Any);
    }
    let origins: Vec<HeaderValue> = allowed
        .iter()
        .filter_map(|s| HeaderValue::from_str(s).ok())
        .collect();
    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods(methods)
        .allow_headers(tower_http::cors::Any)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            sig.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
    info!("shutdown signal received");
}
