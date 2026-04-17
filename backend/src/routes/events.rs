use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::{Query, State},
    response::sse::{Event, KeepAlive, Sse},
};
use futures::stream::Stream;
use serde::Deserialize;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};

use crate::state::AppState;

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct StreamQuery {
    pub wallet: Option<String>,
}

pub async fn stream(
    State(state): State<AppState>,
    Query(q): Query<StreamQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.bus.subscribe();
    let wallet = q.wallet;
    let stream = BroadcastStream::new(rx).filter_map(move |item| {
        let msg = item.ok()?;
        if let Some(filter) = &wallet {
            let owner_match = msg.owner_lock_hash.as_deref() == Some(filter.as_str());
            let claimer_match = msg.claimer_lock_hash.as_deref() == Some(filter.as_str());
            if !(owner_match || claimer_match) {
                return None;
            }
        }
        let payload = serde_json::to_string(&msg).ok()?;
        Some(Ok(Event::default().event(&msg.event_type).data(payload)))
    });

    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}
