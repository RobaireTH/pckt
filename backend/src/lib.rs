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
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

use crate::{config::Config, indexer::Indexer, state::AppState};

pub async fn run(config: Config) -> anyhow::Result<()> {
    let pool = db::connect(&config.database_url).await?;
    db::migrate(&pool).await?;

    let state = AppState::new(pool, config);

    let indexer = Indexer::new(state.clone());
    tokio::spawn(async move { indexer.run().await });

    let app = routes::router()
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state.clone());

    let addr: SocketAddr = ([0, 0, 0, 0], state.config.port).into();
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    info!(%addr, "pckt-backend listening");
    axum::serve(listener, app).await?;
    Ok(())
}
