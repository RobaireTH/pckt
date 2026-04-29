use bech32::{Bech32m, Hrp};
use std::env;

fn parse_hex(s: &str) -> Vec<u8> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 4 {
        eprintln!(
            "usage: {} <code_hash_hex> <hash_type:data|type|data1|data2> <args_hex>",
            args[0]
        );
        std::process::exit(1);
    }
    let code_hash = parse_hex(&args[1]);
    if code_hash.len() != 32 {
        eprintln!("code_hash must be 32 bytes");
        std::process::exit(1);
    }
    let hash_type_byte = match args[2].as_str() {
        "data" => 0u8,
        "type" => 1u8,
        "data1" => 2u8,
        "data2" => 4u8,
        _ => {
            eprintln!("unknown hash_type");
            std::process::exit(1);
        }
    };
    let script_args = parse_hex(&args[3]);

    // CKB full address payload: 0x00 || code_hash(32) || hash_type(1) || args
    let mut payload = Vec::with_capacity(1 + 32 + 1 + script_args.len());
    payload.push(0x00);
    payload.extend_from_slice(&code_hash);
    payload.push(hash_type_byte);
    payload.extend_from_slice(&script_args);

    let hrp = Hrp::parse("ckt").unwrap();
    let encoded = bech32::encode::<Bech32m>(hrp, &payload).unwrap();
    println!("{}", encoded);
}
