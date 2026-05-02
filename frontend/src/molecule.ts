import {
  mol,
  bytesFrom,
  hexFrom,
  type BytesLike,
  type Hex,
  type HexLike,
  type NumLike,
} from '@ckb-ccc/connector-react';

function fixedBytes(len: number) {
  return mol.Codec.from<HexLike, Hex>({
    byteLength: len,
    encode: (v: HexLike) => bytesFrom(v),
    decode: (b: BytesLike) => hexFrom(b),
  });
}

const Byte33 = fixedBytes(33);
const Byte65 = fixedBytes(65);

export const PacketDataCodec = mol.table({
  version: mol.Uint8,
  packet_type: mol.Uint8,
  slots_total: mol.Uint8,
  slots_claimed: mol.Uint8,
  expiry: mol.Uint64,
  unlock_time: mol.Uint64,
  initial_capacity: mol.Uint64,
  owner_lock_hash: mol.Byte32,
  claim_pubkey: Byte33,
  salt: mol.Byte16,
  message: mol.Bytes,
  claimed_locks: mol.Byte32Vec,
});

const ClaimCodec = mol.table({
  signature: Byte65,
  claimer_lock_hash: mol.Byte32,
});

const ReclaimCodec = mol.table({});

const PacketActionCodec = mol.union({ Claim: ClaimCodec, Reclaim: ReclaimCodec });

export const PacketWitnessCodec = mol.table({
  action: PacketActionCodec,
});

export type PacketData = {
  version: number;
  packet_type: number;
  slots_total: number;
  slots_claimed: number;
  expiry: NumLike;
  unlock_time: NumLike;
  initial_capacity: NumLike;
  owner_lock_hash: HexLike;
  claim_pubkey: HexLike;
  salt: HexLike;
  message: HexLike;
  claimed_locks: HexLike[];
};

export function encodePacketData(pd: PacketData): Hex {
  return hexFrom(PacketDataCodec.encode(pd));
}

export function decodePacketData(hex: HexLike) {
  return PacketDataCodec.decode(hex);
}

export function encodeClaimWitness(signature: HexLike, claimerLockHash: HexLike): Hex {
  return hexFrom(
    PacketWitnessCodec.encode({
      action: { type: 'Claim', value: { signature, claimer_lock_hash: claimerLockHash } },
    }),
  );
}

export function encodeReclaimWitness(): Hex {
  return hexFrom(
    PacketWitnessCodec.encode({
      action: { type: 'Reclaim', value: {} },
    }),
  );
}

export const SHANNONS_PER_BYTE = 100_000_000n;
export const PD_FIXED_BYTES = 169n;
export const PD_HEADER_BYTES = 52n;
export const CELL_OVERHEAD_BYTES = 57n;
export const MIN_SLOT_SHANNONS = 6_300_000_000n;

export function maxFloor(slotsTotal: number, messageLen: number): bigint {
  const maxLocks = BigInt(slotsTotal) - 1n;
  const pdSize =
    PD_HEADER_BYTES + PD_FIXED_BYTES + (4n + BigInt(messageLen)) + (4n + maxLocks * 32n);
  return (CELL_OVERHEAD_BYTES + pdSize) * SHANNONS_PER_BYTE;
}

export function computeFixedPayout(initialCapacity: bigint, slotsTotal: number): bigint {
  return initialCapacity / BigInt(slotsTotal);
}
