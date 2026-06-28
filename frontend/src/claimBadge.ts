import {
  Script,
  bytesFrom,
  hashCkb,
  hexFrom,
  type Hex,
  type HexLike,
  type ScriptLike,
} from '@ckb-ccc/connector-react';
import { CLAIM_BADGE } from './config';

export type ClaimBadgeMetadata = {
  protocol: 'ckb-pop';
  version: 1;
  scope_kind: 'custom';
  participation_mode: 'online';
  scope_id: string;
  proof_type: 'pckt-claim';
  packet_out_point: string;
  claim_pubkey_hash: string;
  owner_lock_hash: string;
  claimer_lock_hash: string;
  slot_index: number;
  slot_amount: string;
};

export function claimBadgeConfigured() {
  return Boolean(
    CLAIM_BADGE.enabled &&
      CLAIM_BADGE.codeHash &&
      CLAIM_BADGE.txHash &&
      CLAIM_BADGE.capacity > 0n,
  );
}

export function buildClaimBadgeMetadata(params: {
  packetOutPoint: string;
  claimPubkeyHash: string;
  ownerLockHash: string;
  claimerLockHash: string;
  slotIndex: number;
  slotAmount: bigint;
}): ClaimBadgeMetadata {
  return {
    protocol: 'ckb-pop',
    version: 1,
    scope_kind: 'custom',
    participation_mode: 'online',
    scope_id: `pckt:${params.claimPubkeyHash}`,
    proof_type: 'pckt-claim',
    packet_out_point: params.packetOutPoint,
    claim_pubkey_hash: params.claimPubkeyHash,
    owner_lock_hash: params.ownerLockHash,
    claimer_lock_hash: params.claimerLockHash,
    slot_index: params.slotIndex,
    slot_amount: params.slotAmount.toString(),
  };
}

export function encodeClaimBadgeMetadata(metadata: ClaimBadgeMetadata): Hex {
  return hexFrom(new TextEncoder().encode(JSON.stringify(metadata)));
}

export function buildClaimBadgeTypeArgs(params: {
  packetOutPoint: string;
  claimerLockHash: HexLike;
}): Hex {
  const digest = bytesFrom(
    hashCkb(
      new TextEncoder().encode('pckt-claim-badge'),
      new TextEncoder().encode(params.packetOutPoint),
      bytesFrom(params.claimerLockHash),
    ),
  );
  return hexFrom(digest.slice(0, 20));
}

export function buildClaimBadgeOutput(params: {
  ownerLock: ScriptLike;
  packetOutPoint: string;
  claimerLockHash: HexLike;
  metadata: ClaimBadgeMetadata;
}) {
  if (!claimBadgeConfigured()) return null;
  const typeArgs = buildClaimBadgeTypeArgs({
    packetOutPoint: params.packetOutPoint,
    claimerLockHash: params.claimerLockHash,
  });
  return {
    output: {
      lock: Script.from(params.ownerLock),
      type: Script.from({
        codeHash: CLAIM_BADGE.codeHash!,
        hashType: CLAIM_BADGE.hashType,
        args: typeArgs,
      }),
      capacity: CLAIM_BADGE.capacity,
    },
    data: encodeClaimBadgeMetadata(params.metadata),
    cellDep: {
      depType: 'code' as const,
      outPoint: {
        txHash: CLAIM_BADGE.txHash!,
        index: CLAIM_BADGE.index,
      },
    },
  };
}
