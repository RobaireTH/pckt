mod events;
mod healthz;
mod links;
mod messages;
mod packets;
mod prices;
mod relay;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::{rate_limit, state::AppState};

pub fn router(state: &AppState) -> Router<AppState> {
    let limited = Router::new()
        .route("/v1/links", post(links::create))
        .route("/v1/relay/tx", post(relay::submit))
        .route("/v1/messages", post(messages::store))
        .layer(middleware::from_fn_with_state(
            state.rate_limit.clone(),
            rate_limit::middleware,
        ));

    Router::new()
        .route("/healthz", get(healthz::healthz))
        .route("/v1/packets", get(packets::list))
        .route("/v1/packets/:outpoint", get(packets::get_one))
        .route("/v1/packets/:outpoint/events", get(packets::events))
        .route("/v1/packets/by-pubkey/:hash", get(packets::by_pubkey))
        .route("/l/:slug", get(links::redirect))
        .route("/v1/messages/:hash", get(messages::get))
        .route("/v1/prices/ckb", get(prices::ckb))
        .route("/v1/events/stream", get(events::stream))
        .merge(limited)
}
