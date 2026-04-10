mod healthz;
mod links;
mod packets;
mod prices;

use axum::{
    routing::{get, post},
    Router,
};

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/healthz", get(healthz::healthz))
        .route("/v1/packets", get(packets::list))
        .route("/v1/packets/:outpoint", get(packets::get_one))
        .route("/v1/packets/:outpoint/events", get(packets::events))
        .route("/v1/packets/by-pubkey/:hash", get(packets::by_pubkey))
        .route("/v1/links", post(links::create))
        .route("/l/:slug", get(links::redirect))
        .route("/v1/prices/ckb", get(prices::ckb))
}
