use std::sync::Arc;

use axum::extract::FromRef;
use sqlx::SqlitePool;

use crate::{bus::EventBus, config::Config, rate_limit::RateLimit};

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub config: Arc<Config>,
    pub bus: EventBus,
    pub rate_limit: RateLimit,
}

impl AppState {
    pub fn new(db: SqlitePool, config: Config) -> Self {
        let rate_limit = RateLimit::new(config.rate_limit_rps, config.rate_limit_burst);
        Self {
            db,
            config: Arc::new(config),
            bus: EventBus::new(),
            rate_limit,
        }
    }
}

impl FromRef<AppState> for RateLimit {
    fn from_ref(state: &AppState) -> RateLimit {
        state.rate_limit.clone()
    }
}
