use axum::{extract::State, http::HeaderMap, Json};
use serde::{Deserialize, Serialize};

use crate::{
    ckb::CkbRpc,
    config::PacketLock,
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct RelayBody {
    pub signed_tx: serde_json::Value,
}

#[derive(Serialize)]
pub struct RelayResp {
    pub tx_hash: String,
}

pub async fn submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RelayBody>,
) -> ApiResult<Json<RelayResp>> {
    enforce_origin(&headers, &state.config.allowed_origins)?;

    if !body.signed_tx.is_object() {
        return Err(ApiError::BadRequest("signed_tx must be a tx object".into()));
    }
    if !tx_references_packet_lock(&body.signed_tx, &state.config.packet_lock) {
        return Err(ApiError::BadRequest(
            "tx does not reference the pckt packet_lock cell_dep".into(),
        ));
    }
    let rpc = CkbRpc::new(state.config.ckb_rpc_url.clone());
    let tx_hash = rpc.send_transaction(body.signed_tx).await.map_err(|e| {
        tracing::error!(?e, "relay transaction failed");
        classify_relay_error(&e.to_string(), &state.config.packet_lock.code_hash)
    })?;
    tracing::info!(tx_hash = %tx_hash, "relayed packet tx");
    Ok(Json(RelayResp { tx_hash }))
}

fn tx_references_packet_lock(signed_tx: &serde_json::Value, lock: &PacketLock) -> bool {
    let Some(deps) = signed_tx.get("cell_deps").and_then(|v| v.as_array()) else {
        return false;
    };
    let want_tx = lock
        .out_point_tx
        .trim_start_matches("0x")
        .to_ascii_lowercase();
    for dep in deps {
        let Some(op) = dep.get("out_point") else {
            continue;
        };
        let Some(tx_hash) = op.get("tx_hash").and_then(|v| v.as_str()) else {
            continue;
        };
        let Some(index_s) = op.get("index").and_then(|v| v.as_str()) else {
            continue;
        };
        if tx_hash.trim_start_matches("0x").to_ascii_lowercase() != want_tx {
            continue;
        }
        let idx = index_s
            .strip_prefix("0x")
            .or_else(|| index_s.strip_prefix("0X"))
            .and_then(|h| u32::from_str_radix(h, 16).ok())
            .or_else(|| index_s.parse::<u32>().ok());
        if idx == Some(lock.out_point_index) {
            return true;
        }
    }
    false
}

fn packet_lock_error_code(msg: &str, code_hash: &str) -> Option<i64> {
    let want = code_hash.trim_start_matches("0x").to_ascii_lowercase();
    if want.is_empty() {
        return None;
    }
    let lower = msg.to_ascii_lowercase();
    let marker = format!("/{want}.html#");
    let start = lower.find(&marker)? + marker.len();
    let digits: String = lower[start..]
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '-')
        .collect();
    digits.parse().ok()
}

fn classify_relay_error(msg: &str, packet_code_hash: &str) -> ApiError {
    match packet_lock_error_code(msg, packet_code_hash) {
        Some(55) => {
            return ApiError::Conflict("This wallet already claimed this packet.".into());
        }
        Some(54) => {
            return ApiError::Conflict("This packet has already been fully claimed.".into());
        }
        Some(53) => {
            return ApiError::Conflict(
                "This packet is still sealed and cannot be claimed yet.".into(),
            );
        }
        Some(80) => {
            return ApiError::Conflict("This packet cannot be reclaimed until it expires.".into());
        }
        Some(82) => {
            return ApiError::Conflict(
                "This packet still has an active successor and cannot be reclaimed.".into(),
            );
        }
        _ => {}
    }
    if msg.contains("InsufficientCellCapacity") {
        return ApiError::BadRequest(
            "The resulting claim cell is below CKB's minimum live-cell capacity.".into(),
        );
    }
    ApiError::Upstream(msg.into())
}

pub(crate) fn enforce_origin(headers: &HeaderMap, allowed: &[String]) -> ApiResult<()> {
    if allowed.iter().any(|s| s == "*") {
        return Ok(());
    }
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::BadRequest("Origin header required".into()))?;
    if !allowed.iter().any(|a| a == origin) {
        return Err(ApiError::BadRequest("origin not allowed".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{classify_relay_error, tx_references_packet_lock};
    use crate::config::PacketLock;
    use crate::error::ApiError;

    fn fixture_lock() -> PacketLock {
        PacketLock {
            code_hash: "0xaa".into(),
            hash_type: "data1".into(),
            out_point_tx: "0xabcdef0000000000000000000000000000000000000000000000000000000001"
                .into(),
            out_point_index: 1,
        }
    }

    #[test]
    fn accepts_tx_with_matching_cell_dep() {
        let lock = fixture_lock();
        let tx = serde_json::json!({
            "cell_deps": [{
                "out_point": { "tx_hash": lock.out_point_tx, "index": "0x1" },
                "dep_type": "code"
            }],
            "inputs": [],
            "outputs": [],
        });
        assert!(tx_references_packet_lock(&tx, &lock));
    }

    #[test]
    fn rejects_tx_with_empty_cell_deps() {
        let lock = fixture_lock();
        let tx = serde_json::json!({ "cell_deps": [], "inputs": [], "outputs": [] });
        assert!(!tx_references_packet_lock(&tx, &lock));
    }

    #[test]
    fn rejects_tx_with_foreign_cell_dep() {
        let lock = fixture_lock();
        let tx = serde_json::json!({
            "cell_deps": [{
                "out_point": {
                    "tx_hash": "0x1111111111111111111111111111111111111111111111111111111111111111",
                    "index": "0x0"
                },
                "dep_type": "code"
            }],
        });
        assert!(!tx_references_packet_lock(&tx, &lock));
    }

    #[test]
    fn rejects_tx_with_matching_hash_but_wrong_index() {
        let lock = fixture_lock();
        let tx = serde_json::json!({
            "cell_deps": [{
                "out_point": { "tx_hash": lock.out_point_tx, "index": "0x2" },
                "dep_type": "code"
            }],
        });
        assert!(!tx_references_packet_lock(&tx, &lock));
    }

    const PACKET_HASH: &str = "0x5d70f3f6754486b9d666868455376931f2d6babb3593256a1fa2ab3218d7cbc1";

    fn script_failure(code_hash: &str, code: i64) -> String {
        let hash = code_hash.trim_start_matches("0x");
        format!(
            "ckb rpc send_transaction: TransactionFailedToVerify: Verification failed Script(TransactionScriptError {{ source: Inputs[0].Lock, cause: ValidationFailure: see error code {code} on page https://nervosnetwork.github.io/ckb-script-error-codes/by-data-hash/{hash}.html#{code} }})"
        )
    }

    fn conflict_message(err: ApiError) -> String {
        match err {
            ApiError::Conflict(msg) => msg,
            other => panic!("expected conflict, got {other:?}"),
        }
    }

    #[test]
    fn maps_already_claimed_to_conflict() {
        let err = classify_relay_error(&script_failure(PACKET_HASH, 55), PACKET_HASH);
        assert!(conflict_message(err).contains("already claimed"));
    }

    #[test]
    fn maps_packet_full_to_conflict() {
        let err = classify_relay_error(&script_failure(PACKET_HASH, 54), PACKET_HASH);
        assert!(conflict_message(err).contains("fully claimed"));
    }

    #[test]
    fn maps_reclaim_before_expiry_to_conflict() {
        let err = classify_relay_error(&script_failure(PACKET_HASH, 80), PACKET_HASH);
        assert!(conflict_message(err).contains("reclaimed until it expires"));
    }

    #[test]
    fn leaves_other_scripts_error_codes_alone() {
        let other = "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8";
        for code in [53, 54, 55, 80, 82] {
            let err = classify_relay_error(&script_failure(other, code), PACKET_HASH);
            assert!(matches!(err, ApiError::Upstream(_)), "code {code}");
        }
    }

    #[test]
    fn ignores_codes_that_only_appear_in_free_text() {
        let err = classify_relay_error("relay failed: error code 55", PACKET_HASH);
        assert!(matches!(err, ApiError::Upstream(_)));
    }
}
