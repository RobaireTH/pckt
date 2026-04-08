pub mod config;

use std::net::SocketAddr;

use anyhow::Context;
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

use crate::config::Config;

pub async fn run(config: Config) -> anyhow::Result<()> {
    let app = axum::Router::new()
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    let addr: SocketAddr = ([0, 0, 0, 0], config.port).into();
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    info!(%addr, "pckt-backend listening");
    axum::serve(listener, app).await?;
    Ok(())
}
