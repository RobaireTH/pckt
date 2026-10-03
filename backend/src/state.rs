use std::sync::Arc;

use axum::extract::FromRef;
use sqlx::SqlitePool;
use tokio::sync::Semaphore;

use crate::{bus::EventBus, config::Config, rate_limit::RateLimit};

pub const MAX_EVENT_STREAMS: usize = 1000;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub config: Arc<Config>,
    pub bus: EventBus,
    pub rate_limit: RateLimit,
    pub event_streams: Arc<Semaphore>,
}

impl AppState {
    pub fn new(db: SqlitePool, config: Config) -> Self {
        let rate_limit = RateLimit::new(
            config.rate_limit_rps,
            config.rate_limit_burst,
            config.trust_forwarded_for,
        );
        Self {
            db,
            config: Arc::new(config),
            bus: EventBus::new(),
            rate_limit,
            event_streams: Arc::new(Semaphore::new(MAX_EVENT_STREAMS)),
        }
    }
}

impl FromRef<AppState> for RateLimit {
    fn from_ref(state: &AppState) -> RateLimit {
        state.rate_limit.clone()
    }
}
