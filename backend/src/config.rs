use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub network: Network,
    pub ckb_rpc_url: String,
    pub ckb_indexer_url: String,
    pub database_url: String,
    pub port: u16,
    pub price_feed_url: String,
    pub shortlink_base: String,
    pub packet_lock: PacketLock,
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Network {
    Devnet,
    Testnet,
    Mainnet,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PacketLock {
    pub code_hash: String,
    pub hash_type: String,
    pub out_point_tx: String,
    pub out_point_index: u32,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            network: parse_network(&env_var("CKB_NETWORK")?)?,
            ckb_rpc_url: env_var("CKB_RPC_URL")?,
            ckb_indexer_url: env_var("CKB_INDEXER_URL")?,
            database_url: env_var("DATABASE_URL")?,
            port: env_or("PORT", "8080").parse().context("PORT")?,
            price_feed_url: env_var("PRICE_FEED_URL")?,
            shortlink_base: env_var("SHORTLINK_BASE")?,
            packet_lock: PacketLock {
                code_hash: env_var("PACKET_LOCK_CODE_HASH")?,
                hash_type: env_var("PACKET_LOCK_HASH_TYPE")?,
                out_point_tx: env_var("PACKET_LOCK_OUT_POINT_TX")?,
                out_point_index: env_or("PACKET_LOCK_OUT_POINT_INDEX", "0")
                    .parse()
                    .context("PACKET_LOCK_OUT_POINT_INDEX")?,
            },
            allowed_origins: env_or("ALLOWED_ORIGINS", "*")
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect(),
        })
    }
}

fn env_var(key: &str) -> Result<String> {
    std::env::var(key).with_context(|| format!("missing env var: {key}"))
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

fn parse_network(value: &str) -> Result<Network> {
    match value {
        "devnet" => Ok(Network::Devnet),
        "testnet" => Ok(Network::Testnet),
        "mainnet" => Ok(Network::Mainnet),
        other => anyhow::bail!("unknown CKB_NETWORK: {other}"),
    }
}
