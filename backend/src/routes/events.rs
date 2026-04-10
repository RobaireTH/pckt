use axum::extract::Query;
use serde::Deserialize;

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct StreamQuery {
    pub wallet: Option<String>,
}

pub async fn stream(Query(_q): Query<StreamQuery>) -> &'static str {
    "stream endpoint reserved"
}
