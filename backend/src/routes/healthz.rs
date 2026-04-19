use axum::{extract::State, Json};
use serde::Serialize;

use crate::{db, state::AppState};

#[derive(Serialize)]
pub struct Health {
    pub ok: bool,
    pub version: &'static str,
    pub indexer: IndexerHealth,
}

#[derive(Serialize)]
pub struct IndexerHealth {
    pub cursor: u64,
}

pub async fn healthz(State(state): State<AppState>) -> Json<Health> {
    let cursor = db::cursor::load(&state.db).await.unwrap_or(0);
    Json(Health {
        ok: true,
        version: env!("CARGO_PKG_VERSION"),
        indexer: IndexerHealth { cursor },
    })
}
