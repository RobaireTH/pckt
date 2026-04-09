mod healthz;

use axum::{routing::get, Router};

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/healthz", get(healthz::healthz))
}
