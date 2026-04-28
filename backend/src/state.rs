use std::sync::Arc;

use sqlx::SqlitePool;

use crate::{bus::EventBus, config::Config};

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub config: Arc<Config>,
    pub bus: EventBus,
}

impl AppState {
    pub fn new(db: SqlitePool, config: Config) -> Self {
        Self {
            db,
            config: Arc::new(config),
            bus: EventBus::new(),
        }
    }
}
