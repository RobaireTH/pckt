use ckb_hash::blake2b_256;

pub fn blake160(input: &[u8]) -> [u8; 20] {
    let full = blake2b_256(input);
    let mut out = [0u8; 20];
    out.copy_from_slice(&full[..20]);
    out
}

pub fn script_hash(code_hash: &[u8; 32], hash_type: u8, args: &[u8]) -> [u8; 32] {
    blake2b_256(encode_script(code_hash, hash_type, args))
}

pub fn encode_script(code_hash: &[u8; 32], hash_type: u8, args: &[u8]) -> Vec<u8> {
    let header_size: u32 = 16;
    let body_size: u32 = 32 + 1 + 4 + args.len() as u32;
    let total: u32 = header_size + body_size;
    let mut buf = Vec::with_capacity(total as usize);
    buf.extend_from_slice(&total.to_le_bytes());
    buf.extend_from_slice(&16u32.to_le_bytes());
    buf.extend_from_slice(&(16u32 + 32).to_le_bytes());
    buf.extend_from_slice(&(16u32 + 32 + 1).to_le_bytes());
    buf.extend_from_slice(code_hash);
    buf.push(hash_type);
    buf.extend_from_slice(&(args.len() as u32).to_le_bytes());
    buf.extend_from_slice(args);
    buf
}

pub fn hex_str(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(2 + bytes.len() * 2);
    out.push_str("0x");
    const HEX: &[u8; 16] = b"0123456789abcdef";
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

pub fn decode_hex(s: &str) -> Option<Vec<u8>> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if !s.len().is_multiple_of(2) {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() / 2);
    for chunk in s.as_bytes().chunks(2) {
        let hi = nibble_val(chunk[0])?;
        let lo = nibble_val(chunk[1])?;
        out.push((hi << 4) | lo);
    }
    Some(out)
}

pub fn hash_type_byte(hash_type: &str) -> u8 {
    match hash_type {
        "type" => 1,
        "data1" => 2,
        "data2" => 4,
        _ => 0,
    }
}

fn nibble_val(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}
