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
    pub shortlink_allowed_hosts: Vec<String>,
    pub packet_lock: PacketLock,
    pub allowed_origins: Vec<String>,
    pub rate_limit_rps: f64,
    pub rate_limit_burst: f64,
    pub trust_forwarded_for: bool,
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
        let shortlink_base = env_var("SHORTLINK_BASE")?;
        let shortlink_allowed_hosts = parse_allowed_hosts(
            env_or("SHORTLINK_ALLOWED_HOSTS", "").as_str(),
            &shortlink_base,
        );
        Ok(Self {
            network: parse_network(&env_var("CKB_NETWORK")?)?,
            ckb_rpc_url: env_var("CKB_RPC_URL")?,
            ckb_indexer_url: env_var("CKB_INDEXER_URL")?,
            database_url: env_var("DATABASE_URL")?,
            port: env_or("PORT", "8080").parse().context("PORT")?,
            price_feed_url: env_var("PRICE_FEED_URL")?,
            shortlink_base,
            shortlink_allowed_hosts,
            packet_lock: PacketLock {
                code_hash: env_var("PACKET_LOCK_CODE_HASH")?,
                hash_type: env_var("PACKET_LOCK_HASH_TYPE")?,
                out_point_tx: env_var("PACKET_LOCK_OUT_POINT_TX")?,
                out_point_index: parse_u32_maybe_hex(&env_or("PACKET_LOCK_OUT_POINT_INDEX", "0"))
                    .context("PACKET_LOCK_OUT_POINT_INDEX")?,
            },
            allowed_origins: env_or("ALLOWED_ORIGINS", "*")
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect(),
            rate_limit_rps: env_or("RATE_LIMIT_RPS", "5")
                .parse()
                .context("RATE_LIMIT_RPS")?,
            rate_limit_burst: env_or("RATE_LIMIT_BURST", "10")
                .parse()
                .context("RATE_LIMIT_BURST")?,
            trust_forwarded_for: parse_bool(&env_or("TRUST_FORWARDED_FOR", "false")),
        })
    }
}

fn parse_bool(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
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

fn parse_allowed_hosts(env_value: &str, shortlink_base: &str) -> Vec<String> {
    let mut hosts: Vec<String> = env_value
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_ascii_lowercase())
        .collect();
    if let Some(host) = url::Url::parse(shortlink_base)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_ascii_lowercase()))
    {
        if !hosts.iter().any(|h| h == &host) {
            hosts.push(host);
        }
    }
    hosts
}

pub fn host_is_allowed(host: &str, allowed: &[String]) -> bool {
    let host = host.to_ascii_lowercase();
    allowed.iter().any(|pat| {
        if let Some(suffix) = pat.strip_prefix("*.") {
            host == suffix || host.ends_with(&format!(".{suffix}"))
        } else {
            pat == &host
        }
    })
}

fn parse_u32_maybe_hex(value: &str) -> Result<u32> {
    if let Some(hex) = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
    {
        return u32::from_str_radix(hex, 16).with_context(|| format!("parse hex u32: {value}"));
    }
    value.parse().with_context(|| format!("parse u32: {value}"))
}

#[cfg(test)]
mod tests {
    use super::parse_u32_maybe_hex;

    #[test]
    fn parses_decimal_or_hex_out_point_index() {
        assert_eq!(parse_u32_maybe_hex("0").unwrap(), 0);
        assert_eq!(parse_u32_maybe_hex("17").unwrap(), 17);
        assert_eq!(parse_u32_maybe_hex("0x11").unwrap(), 17);
        assert_eq!(parse_u32_maybe_hex("0X11").unwrap(), 17);
    }
}
