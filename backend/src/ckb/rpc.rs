use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone)]
pub struct CkbRpc { client: Client, url: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TipHeader { pub number: u64, pub hash: String, pub timestamp: u64 }

impl CkbRpc {
    pub fn new(url: impl Into<String>) -> Self {
        Self { client: Client::new(), url: url.into() }
    }

    pub async fn tip_header(&self) -> Result<TipHeader> {
        let raw: Value = self.call("get_tip_header", json!([])).await?;
        let number = parse_hex_u64(raw.get("number"))?;
        let timestamp = parse_hex_u64(raw.get("timestamp"))?;
        let hash = raw.get("hash").and_then(Value::as_str).ok_or_else(|| anyhow!("missing hash"))?.to_string();
        Ok(TipHeader { number, hash, timestamp })
    }

    pub async fn block_by_number(&self, number: u64) -> Result<Option<Value>> {
        let hex = format!("0x{number:x}");
        let raw: Value = self.call("get_block_by_number", json!([hex])).await?;
        if raw.is_null() { return Ok(None); }
        Ok(Some(raw))
    }

    pub async fn send_transaction(&self, tx: Value) -> Result<String> {
        let raw: Value = self.call("send_transaction", json!([tx, "passthrough"])).await?;
        raw.as_str().map(str::to_string).ok_or_else(|| anyhow!("send_transaction returned non-string: {raw}"))
    }

    async fn call(&self, method: &str, params: Value) -> Result<Value> {
        let body = json!({"id": 1, "jsonrpc": "2.0", "method": method, "params": params});
        let resp = self.client.post(&self.url).json(&body).send().await
            .with_context(|| format!("ckb rpc {method}"))?
            .error_for_status()
            .with_context(|| format!("ckb rpc {method} status"))?;
        let mut env: Value = resp.json().await.context("ckb rpc decode")?;
        if let Some(err) = env.get("error") { return Err(anyhow!("ckb rpc error: {err}")); }
        env.get_mut("result").map(Value::take).ok_or_else(|| anyhow!("ckb rpc {method}: no result"))
    }
}

fn parse_hex_u64(value: Option<&Value>) -> Result<u64> {
    let s = value.and_then(Value::as_str).ok_or_else(|| anyhow!("expected hex string"))?;
    let s = s.strip_prefix("0x").unwrap_or(s);
    u64::from_str_radix(s, 16).with_context(|| format!("parse hex u64: {s}"))
}
