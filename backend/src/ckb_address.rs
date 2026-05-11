use bech32::{primitives::decode::CheckedHrpstring, Bech32m, Hrp};

use crate::crypto::script_hash;

#[derive(Debug, PartialEq, Eq)]
pub enum AddressError {
    Bech32,
    BadHrp,
    BadVersion,
    BadPayload,
    BadHashType,
}

pub fn lock_hash_from_address(addr: &str) -> Result<[u8; 32], AddressError> {
    let parsed = CheckedHrpstring::new::<Bech32m>(addr).map_err(|_| AddressError::Bech32)?;
    let hrp = parsed.hrp();
    if hrp != Hrp::parse_unchecked("ckb") && hrp != Hrp::parse_unchecked("ckt") {
        return Err(AddressError::BadHrp);
    }
    let payload: Vec<u8> = parsed.byte_iter().collect();
    if payload.len() < 34 {
        return Err(AddressError::BadPayload);
    }
    if payload[0] != 0x00 {
        return Err(AddressError::BadVersion);
    }
    let mut code_hash = [0u8; 32];
    code_hash.copy_from_slice(&payload[1..33]);
    let hash_type = payload[33];
    if !matches!(hash_type, 0 | 1 | 2 | 4) {
        return Err(AddressError::BadHashType);
    }
    let args = &payload[34..];
    Ok(script_hash(&code_hash, hash_type, args))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::script_hash;
    use bech32::{Bech32m, Hrp};

    fn encode_full_format(hrp: &str, code_hash: &[u8; 32], hash_type: u8, args: &[u8]) -> String {
        let mut payload = Vec::with_capacity(34 + args.len());
        payload.push(0x00);
        payload.extend_from_slice(code_hash);
        payload.push(hash_type);
        payload.extend_from_slice(args);
        bech32::encode::<Bech32m>(Hrp::parse(hrp).unwrap(), &payload).unwrap()
    }

    #[test]
    fn decodes_matches_independent_script_hash() {
        let code_hash = [0x11u8; 32];
        let hash_type = 1u8;
        let args = [0xab, 0xcd, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07];
        let addr = encode_full_format("ckt", &code_hash, hash_type, &args);
        let decoded = lock_hash_from_address(&addr).expect("decode");
        let expected = script_hash(&code_hash, hash_type, &args);
        assert_eq!(decoded, expected);
    }

    #[test]
    fn rejects_non_ckb_hrp() {
        let addr = encode_full_format("foo", &[0u8; 32], 0, &[]);
        assert_eq!(lock_hash_from_address(&addr), Err(AddressError::BadHrp));
    }

    #[test]
    fn rejects_short_format_version() {
        let mut payload = Vec::new();
        payload.push(0x01);
        payload.extend_from_slice(&[0u8; 20]);
        let addr = bech32::encode::<Bech32m>(Hrp::parse("ckt").unwrap(), &payload).unwrap();
        assert!(lock_hash_from_address(&addr).is_err());
    }

    #[test]
    fn rejects_bad_hash_type() {
        let addr = encode_full_format("ckt", &[0u8; 32], 3, &[]);
        assert_eq!(
            lock_hash_from_address(&addr),
            Err(AddressError::BadHashType)
        );
    }

    #[test]
    fn rejects_garbage() {
        assert!(matches!(
            lock_hash_from_address("not-a-real-address"),
            Err(AddressError::Bech32)
        ));
    }
}
