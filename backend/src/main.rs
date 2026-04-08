use pckt_backend::{config::Config, run};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "pckt_backend=info,tower_http=info".into()),
        )
        .init();

    let config = Config::from_env()?;
    run(config).await
}
