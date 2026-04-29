#![no_std]
#![no_main]

use alloc::vec::Vec;
use blake2b_ref::Blake2bBuilder;
use ckb_std::ckb_constants::Source;
use ckb_std::ckb_types::prelude::Entity as CkbEntity;
use ckb_std::default_alloc;
use ckb_std::high_level::{
    load_cell_capacity, load_cell_data, load_cell_lock_hash, load_cell_type, load_input,
    load_input_since, load_witness_args,
};
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
use pckt_schema::{Claim, PacketActionUnion, PacketData, PacketWitness};

ckb_std::entry!(program_entry);
default_alloc!();

const MAX_SLOTS: u8 = 64;
const MAX_MESSAGE_LEN: usize = 256;
const VERSION: u8 = 1;
const BLAKE_PERSONAL: &[u8] = b"ckb-default-hash";

const SINCE_FLAG_ABS_TS: u8 = 0x40;
const SINCE_VALUE_MASK: u64 = 0x00FF_FFFF_FFFF_FFFF;

const MIN_SLOT_SHANNONS: u64 = 100_000_000;

const SHANNONS_PER_BYTE: u64 = 100_000_000;
const PD_FIXED_BYTES: u64 = 169;
const PD_HEADER_BYTES: u64 = 52;
const CELL_OVERHEAD_BYTES: u64 = 57;

#[repr(i8)]
enum Error {
    NoInput = 10,
    TooManyInputs = 11,
    BadData = 12,
    BadVersion = 13,
    BadPacketType = 14,
    BadSlots = 15,
    SlotsCountMismatch = 16,
    TooManyClaimed = 17,
    MessageTooLong = 18,
    TimedNeedsUnlock = 19,
    NonTimedHasUnlock = 20,
    MissingWitness = 30,
    BadWitness = 31,
    BadSignature = 40,
    SignaturePubkeyMismatch = 41,
    SinceLoadFailed = 50,
    ExpectedZeroSince = 51,
    BadSinceEncoding = 52,
    TooEarly = 53,
    AllSlotsClaimed = 54,
    AlreadyClaimed = 55,
    CapacityLoadFailed = 60,
    CapacityUnderflow = 61,
    RecipientMissing = 70,
    SuccessorMissing = 71,
    UnexpectedSuccessor = 72,
    SuccessorMismatch = 73,
    SuccessorBadData = 74,
    ReclaimBeforeExpiry = 80,
    OwnerInputMissing = 81,
    ReclaimWithSuccessor = 82,
}

pub fn program_entry() -> i8 {
    match run() {
        Ok(()) => 0,
        Err(e) => e as i8,
    }
}

fn run() -> Result<(), Error> {
    let data = load_input_packet_data()?;
    let pd = PacketData::from_slice(&data).map_err(|_| Error::BadData)?;
    enforce_invariants(&pd)?;

    let witness = load_packet_witness()?;
    match witness.action().to_enum() {
        PacketActionUnion::Claim(claim) => claim_path(&pd, &claim),
        PacketActionUnion::Reclaim(_) => reclaim_path(&pd),
    }
}

fn claim_path(pd: &PacketData, claim: &Claim) -> Result<(), Error> {
    enforce_slot_available(pd)?;
    enforce_no_double_claim(pd, claim)?;
    enforce_claim_timing(pd)?;
    verify_claim_signature(pd, claim)?;
    let payout = compute_payout(pd)?;
    verify_recipient(claim, payout)?;
    verify_successor(pd, claim, payout)?;
    Ok(())
}

fn verify_recipient(claim: &Claim, payout: u64) -> Result<(), Error> {
    let claimer_hash = claim.claimer_lock_hash();
    let claimer_slice = claimer_hash.as_slice();
    for idx in 0.. {
        let lock_hash = match load_cell_lock_hash(idx, Source::Output) {
            Ok(h) => h,
            Err(_) => break,
        };
        if lock_hash.as_ref() != claimer_slice {
            continue;
        }
        let cap = load_cell_capacity(idx, Source::Output).map_err(|_| Error::CapacityLoadFailed)?;
        if cap != payout {
            continue;
        }
        let type_opt =
            load_cell_type(idx, Source::Output).map_err(|_| Error::CapacityLoadFailed)?;
        if type_opt.is_some() {
            continue;
        }
        return Ok(());
    }
    Err(Error::RecipientMissing)
}

fn verify_successor(pd: &PacketData, claim: &Claim, payout: u64) -> Result<(), Error> {
    let total = byte_to_u8(pd.slots_total());
    let claimed = byte_to_u8(pd.slots_claimed());
    let last_slot = claimed + 1 == total;

    let group_out_count = count_group_outputs();
    if last_slot {
        if group_out_count != 0 {
            return Err(Error::UnexpectedSuccessor);
        }
        return Ok(());
    }
    if group_out_count != 1 {
        return Err(Error::SuccessorMissing);
    }

    let succ_data = load_cell_data(0, Source::GroupOutput).map_err(|_| Error::SuccessorMissing)?;
    let succ = PacketData::from_slice(&succ_data).map_err(|_| Error::SuccessorBadData)?;

    if pd.version().as_slice() != succ.version().as_slice()
        || pd.packet_type().as_slice() != succ.packet_type().as_slice()
        || pd.slots_total().as_slice() != succ.slots_total().as_slice()
        || pd.expiry().as_slice() != succ.expiry().as_slice()
        || pd.unlock_time().as_slice() != succ.unlock_time().as_slice()
        || pd.initial_capacity().as_slice() != succ.initial_capacity().as_slice()
        || pd.owner_lock_hash().as_slice() != succ.owner_lock_hash().as_slice()
        || pd.claim_pubkey().as_slice() != succ.claim_pubkey().as_slice()
        || pd.salt().as_slice() != succ.salt().as_slice()
        || pd.message().as_slice() != succ.message().as_slice()
    {
        return Err(Error::SuccessorMismatch);
    }

    if byte_to_u8(succ.slots_claimed()) != claimed + 1 {
        return Err(Error::SuccessorMismatch);
    }

    let pred_locks = pd.claimed_locks();
    let succ_locks = succ.claimed_locks();
    if succ_locks.len() != pred_locks.len() + 1 {
        return Err(Error::SuccessorMismatch);
    }
    for i in 0..pred_locks.len() {
        let p = pred_locks.get(i).ok_or(Error::SuccessorMismatch)?;
        let s = succ_locks.get(i).ok_or(Error::SuccessorMismatch)?;
        if p.as_slice() != s.as_slice() {
            return Err(Error::SuccessorMismatch);
        }
    }
    let last = succ_locks
        .get(succ_locks.len() - 1)
        .ok_or(Error::SuccessorMismatch)?;
    if last.as_slice() != claim.claimer_lock_hash().as_slice() {
        return Err(Error::SuccessorMismatch);
    }

    let input_cap =
        load_cell_capacity(0, Source::GroupInput).map_err(|_| Error::CapacityLoadFailed)?;
    let succ_cap =
        load_cell_capacity(0, Source::GroupOutput).map_err(|_| Error::CapacityLoadFailed)?;
    if succ_cap
        != input_cap
            .checked_sub(payout)
            .ok_or(Error::CapacityUnderflow)?
    {
        return Err(Error::SuccessorMismatch);
    }

    Ok(())
}

fn count_group_outputs() -> usize {
    let mut count = 0;
    for idx in 0.. {
        match load_cell_capacity(idx, Source::GroupOutput) {
            Ok(_) => count += 1,
            Err(_) => break,
        }
    }
    count
}

fn max_floor(pd: &PacketData) -> u64 {
    let slots_total = byte_to_u8(pd.slots_total()) as u64;
    let msg_len = pd.message().raw_data().len() as u64;
    let max_locks = slots_total.saturating_sub(1);
    let pd_size = PD_HEADER_BYTES + PD_FIXED_BYTES + (4 + msg_len) + (4 + max_locks * 32);
    (CELL_OVERHEAD_BYTES + pd_size) * SHANNONS_PER_BYTE
}

fn compute_payout(pd: &PacketData) -> Result<u64, Error> {
    let total = byte_to_u8(pd.slots_total()) as u64;
    let claimed = byte_to_u8(pd.slots_claimed()) as u64;
    let pt = byte_to_u8(pd.packet_type());
    let lucky = pt == 1 || pt == 3;

    let input_capacity =
        load_cell_capacity(0, Source::GroupInput).map_err(|_| Error::CapacityLoadFailed)?;
    let floor = max_floor(pd);
    let remaining_pool = input_capacity
        .checked_sub(floor)
        .ok_or(Error::CapacityUnderflow)?;
    let remaining_slots = total - claimed;

    if remaining_slots == 1 {
        return Ok(input_capacity);
    }

    let payout = if !lucky {
        let users_total = read_u64(&pd.initial_capacity());
        users_total / total
    } else {
        let must_reserve = MIN_SLOT_SHANNONS.saturating_mul(remaining_slots - 1);
        let max_for_this = remaining_pool.saturating_sub(must_reserve);
        let avg = remaining_pool / remaining_slots;
        let upper = avg.saturating_mul(2).min(max_for_this);
        let lower = MIN_SLOT_SHANNONS;
        let seed = slot_seed(pd.salt().as_slice(), claimed as u8);
        let range = upper.saturating_sub(lower);
        if range > 0 {
            (seed % range) + lower
        } else {
            lower
        }
    };

    Ok(payout)
}

fn slot_seed(salt: &[u8], slot_idx: u8) -> u64 {
    let mut hasher = Blake2bBuilder::new(32).personal(BLAKE_PERSONAL).build();
    hasher.update(salt);
    hasher.update(&[slot_idx]);
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    let mut u = [0u8; 8];
    u.copy_from_slice(&out[..8]);
    u64::from_le_bytes(u)
}

fn reclaim_path(pd: &PacketData) -> Result<(), Error> {
    let since = load_input_since(0, Source::GroupInput).map_err(|_| Error::SinceLoadFailed)?;
    let high_byte = (since >> 56) as u8;
    if high_byte != SINCE_FLAG_ABS_TS {
        return Err(Error::BadSinceEncoding);
    }
    let ts = since & SINCE_VALUE_MASK;
    let expiry = read_u64(&pd.expiry());
    if ts < expiry {
        return Err(Error::ReclaimBeforeExpiry);
    }

    let owner = pd.owner_lock_hash();
    let owner_slice = owner.as_slice();
    let mut found_owner = false;
    for idx in 0.. {
        let lh = match load_cell_lock_hash(idx, Source::Input) {
            Ok(h) => h,
            Err(_) => break,
        };
        if lh.as_ref() == owner_slice {
            found_owner = true;
            break;
        }
    }
    if !found_owner {
        return Err(Error::OwnerInputMissing);
    }

    if count_group_outputs() != 0 {
        return Err(Error::ReclaimWithSuccessor);
    }

    Ok(())
}

fn enforce_slot_available(pd: &PacketData) -> Result<(), Error> {
    let total = byte_to_u8(pd.slots_total());
    let claimed = byte_to_u8(pd.slots_claimed());
    if claimed >= total {
        return Err(Error::AllSlotsClaimed);
    }
    Ok(())
}

fn enforce_no_double_claim(pd: &PacketData, claim: &Claim) -> Result<(), Error> {
    let claimer = claim.claimer_lock_hash();
    let claimer_slice = claimer.as_slice();
    for h in pd.claimed_locks().into_iter() {
        if h.as_slice() == claimer_slice {
            return Err(Error::AlreadyClaimed);
        }
    }
    Ok(())
}

fn enforce_claim_timing(pd: &PacketData) -> Result<(), Error> {
    let pt = byte_to_u8(pd.packet_type());
    let timed = pt == 2 || pt == 3;
    let since = load_input_since(0, Source::GroupInput).map_err(|_| Error::SinceLoadFailed)?;

    if !timed {
        if since != 0 {
            return Err(Error::ExpectedZeroSince);
        }
        return Ok(());
    }

    let high_byte = (since >> 56) as u8;
    if high_byte != SINCE_FLAG_ABS_TS {
        return Err(Error::BadSinceEncoding);
    }
    let ts = since & SINCE_VALUE_MASK;
    let unlock = read_u64(&pd.unlock_time());
    if ts < unlock {
        return Err(Error::TooEarly);
    }
    Ok(())
}

fn verify_claim_signature(pd: &PacketData, claim: &Claim) -> Result<(), Error> {
    let outpoint_bytes = load_input_outpoint_bytes()?;
    let claimer = claim.claimer_lock_hash();
    let msg = blake256_2(&outpoint_bytes, claimer.as_slice());

    let sig_bytes = claim.signature();
    let sig_slice = sig_bytes.as_slice();
    if sig_slice.len() != 65 {
        return Err(Error::BadSignature);
    }
    let recovery_id = RecoveryId::try_from(sig_slice[64]).map_err(|_| Error::BadSignature)?;
    let signature = Signature::from_slice(&sig_slice[..64]).map_err(|_| Error::BadSignature)?;
    let key = VerifyingKey::recover_from_prehash(&msg, &signature, recovery_id)
        .map_err(|_| Error::BadSignature)?;
    let recovered = key.to_encoded_point(true);
    let recovered_bytes = recovered.as_bytes();
    if recovered_bytes != pd.claim_pubkey().as_slice() {
        return Err(Error::SignaturePubkeyMismatch);
    }
    Ok(())
}

fn load_input_packet_data() -> Result<Vec<u8>, Error> {
    let bytes = load_cell_data(0, Source::GroupInput).map_err(|_| Error::NoInput)?;
    if load_cell_data(1, Source::GroupInput).is_ok() {
        return Err(Error::TooManyInputs);
    }
    Ok(bytes)
}

fn load_input_outpoint_bytes() -> Result<Vec<u8>, Error> {
    let input = load_input(0, Source::GroupInput).map_err(|_| Error::NoInput)?;
    Ok(input.previous_output().as_slice().to_vec())
}

fn load_packet_witness() -> Result<PacketWitness, Error> {
    let args = load_witness_args(0, Source::GroupInput).map_err(|_| Error::MissingWitness)?;
    let lock_field = args.lock().to_opt().ok_or(Error::MissingWitness)?;
    PacketWitness::from_slice(&lock_field.raw_data()).map_err(|_| Error::BadWitness)
}

fn enforce_invariants(pd: &PacketData) -> Result<(), Error> {
    if byte_to_u8(pd.version()) != VERSION {
        return Err(Error::BadVersion);
    }

    let pt = byte_to_u8(pd.packet_type());
    if pt > 3 {
        return Err(Error::BadPacketType);
    }

    let slots_total = byte_to_u8(pd.slots_total());
    if slots_total == 0 || slots_total > MAX_SLOTS {
        return Err(Error::BadSlots);
    }

    let slots_claimed = byte_to_u8(pd.slots_claimed());
    if slots_claimed > slots_total {
        return Err(Error::TooManyClaimed);
    }
    if slots_claimed as usize != pd.claimed_locks().len() {
        return Err(Error::SlotsCountMismatch);
    }

    if pd.message().raw_data().len() > MAX_MESSAGE_LEN {
        return Err(Error::MessageTooLong);
    }

    let timed = pt == 2 || pt == 3;
    let unlock = read_u64(&pd.unlock_time());
    if timed && unlock == 0 {
        return Err(Error::TimedNeedsUnlock);
    }
    if !timed && unlock != 0 {
        return Err(Error::NonTimedHasUnlock);
    }

    Ok(())
}

fn byte_to_u8(b: molecule::prelude::Byte) -> u8 {
    b.as_slice()[0]
}

fn read_u64(u: &pckt_schema::Uint64) -> u64 {
    let s = u.as_slice();
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&s[..8]);
    u64::from_le_bytes(buf)
}

fn blake256_2(a: &[u8], b: &[u8]) -> [u8; 32] {
    let mut hasher = Blake2bBuilder::new(32).personal(BLAKE_PERSONAL).build();
    hasher.update(a);
    hasher.update(b);
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}
