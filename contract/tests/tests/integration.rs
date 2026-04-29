use ckb_testtool::builtin::ALWAYS_SUCCESS;
use ckb_testtool::ckb_types::{
    bytes::Bytes,
    core::TransactionBuilder,
    packed::{CellInput, CellOutput, WitnessArgs},
    prelude::*,
};
use ckb_testtool::context::Context;
use molecule::prelude::*;
use pckt_schema::{
    Byte16, Byte32, Byte32Vec, Byte33, Bytes as MolBytes, Claim, PacketAction, PacketData,
    PacketWitness, Reclaim, Uint64,
};

const MAX_CYCLES: u64 = 70_000_000;
const PCKT_LOCK_BIN: &[u8] =
    include_bytes!("../../target/riscv64imac-unknown-none-elf/release/pckt-lock");

const SINCE_FLAG_ABS_TS: u64 = 0x4000_0000_0000_0000;

fn uint64_mol(v: u64) -> Uint64 {
    let bytes = v.to_le_bytes();
    Uint64::new_builder()
        .set([
            bytes[0].into(),
            bytes[1].into(),
            bytes[2].into(),
            bytes[3].into(),
            bytes[4].into(),
            bytes[5].into(),
            bytes[6].into(),
            bytes[7].into(),
        ])
        .build()
}

fn byte32(arr: [u8; 32]) -> Byte32 {
    Byte32::new_builder().set(arr.map(Into::into)).build()
}

fn byte33(arr: [u8; 33]) -> Byte33 {
    Byte33::new_builder().set(arr.map(Into::into)).build()
}

fn byte16(arr: [u8; 16]) -> Byte16 {
    Byte16::new_builder().set(arr.map(Into::into)).build()
}

fn mol_bytes(src: &[u8]) -> MolBytes {
    let v: Vec<molecule::prelude::Byte> = src.iter().copied().map(Into::into).collect();
    MolBytes::new_builder().extend(v).build()
}

#[derive(Clone)]
struct PdBuilder {
    version: u8,
    packet_type: u8,
    slots_total: u8,
    slots_claimed: u8,
    expiry: u64,
    unlock_time: u64,
    initial_capacity: u64,
    owner_lock_hash: [u8; 32],
    claim_pubkey: [u8; 33],
    salt: [u8; 16],
    message: Vec<u8>,
    claimed_locks: Vec<[u8; 32]>,
}

impl Default for PdBuilder {
    fn default() -> Self {
        Self {
            version: 1,
            packet_type: 0,
            slots_total: 1,
            slots_claimed: 0,
            expiry: 0,
            unlock_time: 0,
            initial_capacity: 0,
            owner_lock_hash: [0u8; 32],
            claim_pubkey: [0u8; 33],
            salt: [0u8; 16],
            message: Vec::new(),
            claimed_locks: Vec::new(),
        }
    }
}

impl PdBuilder {
    fn build(self) -> PacketData {
        let claimed = Byte32Vec::new_builder()
            .extend(self.claimed_locks.into_iter().map(byte32))
            .build();
        PacketData::new_builder()
            .version(self.version.into())
            .packet_type(self.packet_type.into())
            .slots_total(self.slots_total.into())
            .slots_claimed(self.slots_claimed.into())
            .expiry(uint64_mol(self.expiry))
            .unlock_time(uint64_mol(self.unlock_time))
            .initial_capacity(uint64_mol(self.initial_capacity))
            .owner_lock_hash(byte32(self.owner_lock_hash))
            .claim_pubkey(byte33(self.claim_pubkey))
            .salt(byte16(self.salt))
            .message(mol_bytes(&self.message))
            .claimed_locks(claimed)
            .build()
    }
}

fn reclaim_witness_bytes() -> Vec<u8> {
    let action = PacketAction::new_builder().set(Reclaim::default()).build();
    let pw = PacketWitness::new_builder().action(action).build();
    let witness_args = WitnessArgs::new_builder()
        .lock(Some(Bytes::copy_from_slice(pw.as_slice())).pack())
        .build();
    witness_args.as_bytes().to_vec()
}

fn claim_witness_bytes(signature: [u8; 65], claimer_lock_hash: [u8; 32]) -> Vec<u8> {
    let claim = Claim::new_builder()
        .signature(
            pckt_schema::Byte65::new_builder()
                .set(signature.map(Into::into))
                .build(),
        )
        .claimer_lock_hash(byte32(claimer_lock_hash))
        .build();
    let action = PacketAction::new_builder().set(claim).build();
    let pw = PacketWitness::new_builder().action(action).build();
    let witness_args = WitnessArgs::new_builder()
        .lock(Some(Bytes::copy_from_slice(pw.as_slice())).pack())
        .build();
    witness_args.as_bytes().to_vec()
}

fn script_hash_bytes(s: &ckb_testtool::ckb_types::packed::Script) -> [u8; 32] {
    let h = s.calc_script_hash();
    let mut out = [0u8; 32];
    out.copy_from_slice(h.as_slice());
    out
}

struct TestEnv {
    ctx: Context,
    pckt_lock_op: ckb_testtool::ckb_types::packed::OutPoint,
    always_op: ckb_testtool::ckb_types::packed::OutPoint,
}

impl TestEnv {
    fn new() -> Self {
        let mut ctx = Context::default();
        let pckt_lock_op = ctx.deploy_cell(Bytes::copy_from_slice(PCKT_LOCK_BIN));
        let always_op = ctx.deploy_cell(ALWAYS_SUCCESS.clone());
        Self {
            ctx,
            pckt_lock_op,
            always_op,
        }
    }

    fn pckt_script(&mut self, salt: [u8; 16]) -> ckb_testtool::ckb_types::packed::Script {
        self.ctx
            .build_script(&self.pckt_lock_op, Bytes::copy_from_slice(&salt))
            .expect("pckt script")
    }

    fn always_script(&mut self) -> ckb_testtool::ckb_types::packed::Script {
        self.ctx
            .build_script(&self.always_op, Bytes::default())
            .expect("always script")
    }
}

#[test]
fn reclaim_happy_path() {
    let mut env = TestEnv::new();
    let owner = env.always_script();
    let owner_hash = script_hash_bytes(&owner);

    let salt = [0x42u8; 16];
    let expiry = 1_700_000_000u64;
    let pd = PdBuilder {
        version: 1,
        packet_type: 0,
        slots_total: 5,
        slots_claimed: 0,
        expiry,
        unlock_time: 0,
        initial_capacity: 50_000_000_000,
        owner_lock_hash: owner_hash,
        claim_pubkey: [0u8; 33],
        salt,
        message: Vec::new(),
        claimed_locks: Vec::new(),
        ..Default::default()
    }
    .build();

    let pckt = env.pckt_script(salt);
    let packet_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(100_000_000_000u64.pack())
                    .lock(pckt)
                    .build(),
                pd.as_bytes(),
            ),
        )
        .since((SINCE_FLAG_ABS_TS | (expiry + 1)).pack())
        .build();

    let owner_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(10_000_000_000u64.pack())
                    .lock(owner)
                    .build(),
                Bytes::new(),
            ),
        )
        .build();

    let witness = reclaim_witness_bytes();
    let tx = TransactionBuilder::default()
        .input(packet_input)
        .input(owner_input)
        .witness(witness.pack())
        .witness(Bytes::new().pack())
        .build();
    let tx = env.ctx.complete_tx(tx);
    env.ctx.verify_tx(&tx, MAX_CYCLES).expect("reclaim passes");
}

#[test]
fn reclaim_before_expiry_rejected() {
    let mut env = TestEnv::new();
    let owner = env.always_script();
    let owner_hash = script_hash_bytes(&owner);

    let salt = [0x11u8; 16];
    let expiry = 1_700_000_000u64;
    let pd = PdBuilder {
        version: 1,
        packet_type: 0,
        slots_total: 3,
        slots_claimed: 0,
        expiry,
        unlock_time: 0,
        initial_capacity: 30_000_000_000,
        owner_lock_hash: owner_hash,
        claim_pubkey: [0u8; 33],
        salt,
        ..Default::default()
    }
    .build();

    let pckt = env.pckt_script(salt);
    let packet_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(50_000_000_000u64.pack())
                    .lock(pckt)
                    .build(),
                pd.as_bytes(),
            ),
        )
        .since((SINCE_FLAG_ABS_TS | (expiry - 1)).pack())
        .build();

    let owner_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(10_000_000_000u64.pack())
                    .lock(owner)
                    .build(),
                Bytes::new(),
            ),
        )
        .build();

    let witness = reclaim_witness_bytes();
    let tx = TransactionBuilder::default()
        .input(packet_input)
        .input(owner_input)
        .witness(witness.pack())
        .witness(Bytes::new().pack())
        .build();
    let tx = env.ctx.complete_tx(tx);
    let err = env.ctx.verify_tx(&tx, MAX_CYCLES).unwrap_err();
    let msg = format!("{err:?}");
    assert!(
        msg.contains("error code 80"),
        "expected ReclaimBeforeExpiry (80), got: {msg}"
    );
}

#[test]
fn reclaim_without_owner_input_rejected() {
    let mut env = TestEnv::new();
    let owner = env.always_script();
    let owner_hash = script_hash_bytes(&owner);

    let other = env.always_script();
    let salt = [0x22u8; 16];
    let expiry = 1_700_000_000u64;
    let pd = PdBuilder {
        version: 1,
        packet_type: 0,
        slots_total: 3,
        slots_claimed: 0,
        expiry,
        unlock_time: 0,
        initial_capacity: 30_000_000_000,
        owner_lock_hash: owner_hash,
        claim_pubkey: [0u8; 33],
        salt,
        ..Default::default()
    }
    .build();

    let pckt = env.pckt_script(salt);
    let packet_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(50_000_000_000u64.pack())
                    .lock(pckt)
                    .build(),
                pd.as_bytes(),
            ),
        )
        .since((SINCE_FLAG_ABS_TS | (expiry + 1)).pack())
        .build();

    let other_args = Bytes::copy_from_slice(b"different");
    let other_lock = env.ctx.build_script(&env.always_op, other_args).unwrap();
    let other_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(10_000_000_000u64.pack())
                    .lock(other_lock)
                    .build(),
                Bytes::new(),
            ),
        )
        .build();

    let _ = other;

    let witness = reclaim_witness_bytes();
    let tx = TransactionBuilder::default()
        .input(packet_input)
        .input(other_input)
        .witness(witness.pack())
        .witness(Bytes::new().pack())
        .build();
    let tx = env.ctx.complete_tx(tx);
    let err = env.ctx.verify_tx(&tx, MAX_CYCLES).unwrap_err();
    let msg = format!("{err:?}");
    assert!(
        msg.contains("error code 81"),
        "expected OwnerInputMissing (81), got: {msg}"
    );
}

#[test]
fn rejects_bad_version() {
    let mut env = TestEnv::new();
    let owner = env.always_script();
    let owner_hash = script_hash_bytes(&owner);

    let salt = [0x33u8; 16];
    let expiry = 1_700_000_000u64;
    let pd = PdBuilder {
        version: 99,
        packet_type: 0,
        slots_total: 3,
        slots_claimed: 0,
        expiry,
        unlock_time: 0,
        initial_capacity: 30_000_000_000,
        owner_lock_hash: owner_hash,
        claim_pubkey: [0u8; 33],
        salt,
        ..Default::default()
    }
    .build();

    let pckt = env.pckt_script(salt);
    let packet_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(50_000_000_000u64.pack())
                    .lock(pckt)
                    .build(),
                pd.as_bytes(),
            ),
        )
        .since((SINCE_FLAG_ABS_TS | (expiry + 1)).pack())
        .build();

    let owner_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(10_000_000_000u64.pack())
                    .lock(owner)
                    .build(),
                Bytes::new(),
            ),
        )
        .build();

    let witness = reclaim_witness_bytes();
    let tx = TransactionBuilder::default()
        .input(packet_input)
        .input(owner_input)
        .witness(witness.pack())
        .witness(Bytes::new().pack())
        .build();
    let tx = env.ctx.complete_tx(tx);
    let err = env.ctx.verify_tx(&tx, MAX_CYCLES).unwrap_err();
    let msg = format!("{err:?}");
    assert!(
        msg.contains("error code 13"),
        "expected BadVersion (13), got: {msg}"
    );
}

#[test]
fn rejects_claim_with_unsignable_pubkey() {
    let mut env = TestEnv::new();
    let owner = env.always_script();
    let owner_hash = script_hash_bytes(&owner);

    let salt = [0x44u8; 16];
    let pd = PdBuilder {
        version: 1,
        packet_type: 0,
        slots_total: 5,
        slots_claimed: 0,
        expiry: 9_999_999_999,
        unlock_time: 0,
        initial_capacity: 50_000_000_000,
        owner_lock_hash: owner_hash,
        claim_pubkey: [0u8; 33],
        salt,
        ..Default::default()
    }
    .build();

    let pckt = env.pckt_script(salt);
    let packet_input = CellInput::new_builder()
        .previous_output(
            env.ctx.create_cell(
                CellOutput::new_builder()
                    .capacity(100_000_000_000u64.pack())
                    .lock(pckt)
                    .build(),
                pd.as_bytes(),
            ),
        )
        .since(0u64.pack())
        .build();

    let claimer = env.always_script();
    let claimer_hash = script_hash_bytes(&claimer);
    let witness = claim_witness_bytes([0u8; 65], claimer_hash);
    let tx = TransactionBuilder::default()
        .input(packet_input)
        .witness(witness.pack())
        .build();
    let tx = env.ctx.complete_tx(tx);
    let err = env.ctx.verify_tx(&tx, MAX_CYCLES).unwrap_err();
    let msg = format!("{err:?}");
    assert!(
        msg.contains("error code 40") || msg.contains("error code 41"),
        "expected BadSignature (40) or PubkeyMismatch (41), got: {msg}"
    );
}
