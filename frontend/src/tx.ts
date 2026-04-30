import {
  OutPoint,
  Script,
  Transaction,
  WitnessArgs,
  bytesConcat,
  bytesFrom,
  hashCkb,
  hexFrom,
  stringify,
  type Hex,
  type Signer,
} from '@ckb-ccc/connector-react';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createShortlink, relayTransaction } from './api';
import { PCKT_LOCK } from './config';
import {
  decodePacketData,
  encodeClaimWitness,
  encodePacketData,
  maxFloor,
  type PacketData,
} from './molecule';
import { predictClaimPayout, toBigInt } from './packets';
import type { Draft } from './screens/CreateAmount';

const SHANNONS = 100_000_000n;

function utf8Hex(s: string): Hex {
  return hexFrom(new TextEncoder().encode(s));
}

function parseOutPoint(outPoint: string): { txHash: Hex; index: bigint } {
  const [txHash, index] = outPoint.split(':');
  return { txHash: txHash as Hex, index: BigInt(index ?? '0') };
}

function decodePk(hex: string): Uint8Array {
  return bytesFrom(hex.startsWith('0x') ? hex : `0x${hex}`);
}

function pktType(t: Draft['type']) {
  if (t === 'fixed') return 0;
  if (t === 'lucky') return 1;
  return 2;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export async function buildAndRelaySealTx(params: {
  draft: Draft;
  signer: Signer;
  ownerLockHash: string;
}): Promise<{ txHash: string; claimLink: string; publicShortLink: string }> {
  const { draft, signer, ownerLockHash } = params;
  const claimSk = secp256k1.utils.randomPrivateKey();
  const claimPk = secp256k1.getPublicKey(claimSk, true);
  const claimPubkey = hexFrom(claimPk);
  const claimPubkeyHash = hashCkb(claimPk).slice(0, 42) as Hex;
  const salt = hexFrom(crypto.getRandomValues(new Uint8Array(16)));
  const amountCkb = BigInt(draft.amount || '0');
  const initialCapacity = amountCkb * SHANNONS;
  const reservedFloor = maxFloor(draft.slots, new TextEncoder().encode(draft.message).length);
  const capacity = initialCapacity + reservedFloor;
  const unlock = draft.type === 'timed' ? Math.floor(new Date(draft.unlock).getTime() / 1000) : 0;
  const expiry = Math.max(unlock || nowSec(), nowSec()) + 7 * 24 * 3600;

  const pd: PacketData = {
    version: 1,
    packet_type: pktType(draft.type),
    slots_total: draft.slots,
    slots_claimed: 0,
    expiry,
    unlock_time: unlock,
    initial_capacity: initialCapacity,
    owner_lock_hash: ownerLockHash,
    claim_pubkey: claimPubkey,
    salt,
    message: utf8Hex(draft.message),
    claimed_locks: [],
  };

  const lock = Script.from({
    codeHash: PCKT_LOCK.codeHash,
    hashType: PCKT_LOCK.hashType,
    args: claimPubkeyHash,
  });

  const tx = Transaction.from({
    outputs: [{ lock, capacity }],
    outputsData: [encodePacketData(pd)],
  });
  tx.addCellDeps({
    depType: 'code',
    outPoint: { txHash: PCKT_LOCK.txHash, index: PCKT_LOCK.index },
  });
  await tx.completeInputsByCapacity(signer, capacity);
  await tx.completeFeeBy(signer);
  const signed = await signer.signTransaction(tx);
  const signedJson = JSON.parse(stringify(signed));
  const { tx_hash } = await relayTransaction(signedJson);

  const claimLink = `${window.location.origin}/#/claim/${encodeURIComponent(claimPubkeyHash)}/${encodeURIComponent(hexFrom(claimSk))}`;
  const publicTarget = `${window.location.origin}/#/claim?pubkey=${encodeURIComponent(claimPubkeyHash)}`;
  const short = await createShortlink(publicTarget, 7 * 24 * 3600);
  return { txHash: tx_hash, claimLink, publicShortLink: short.short_url };
}

export async function buildAndRelayClaimTx(params: {
  outPoint: string;
  signer: Signer;
  claimPrivateKey: string;
}): Promise<{ txHash: string; payout: bigint }> {
  const { outPoint, signer, claimPrivateKey } = params;
  const op = parseOutPoint(outPoint);
  const packetCell = await signer.client.getCellLive(op, true, true);
  if (!packetCell?.cellOutput) throw new Error('Packet cell not live');
  const pd = decodePacketData(packetCell.outputData);
  const tip = await signer.client.getTipHeader();
  const tipHash = tip.hash;
  const claimer = await signer.getRecommendedAddressObj();
  const claimerLockHash = claimer.script.hash();
  const inputCap = toBigInt(packetCell.cellOutput.capacity.toString());
  const total = Number(pd.slots_total);
  const claimed = Number(pd.slots_claimed);
  if (claimed >= total) throw new Error('Packet already fully claimed');
  const remaining = total - claimed;
  const payout = predictClaimPayout({
    out_point: outPoint,
    packet_type: Number(pd.packet_type),
    slots_total: total,
    slots_claimed: claimed,
    initial_capacity: toBigInt(pd.initial_capacity).toString(),
    current_capacity: inputCap.toString(),
    expiry: Number(pd.expiry),
    unlock_time: Number(pd.unlock_time),
    owner_lock_hash: String(pd.owner_lock_hash),
    claim_pubkey_hash: '',
    salt: String(pd.salt),
    message_body: new TextDecoder().decode(bytesFrom(pd.message)),
  });

  const tx = Transaction.from({
    inputs: [{
      previousOutput: op,
      since:
        Number(pd.packet_type) >= 2
          ? 0x4000000000000000n | BigInt(Math.floor(Date.now() / 1000))
          : 0,
    }],
    headerDeps: [tipHash],
    outputs: [{ lock: claimer.script, capacity: payout }],
    outputsData: ['0x'],
  });

  if (remaining > 1) {
    const nextPd: PacketData = {
      ...pd,
      slots_claimed: claimed + 1,
      claimed_locks: [...pd.claimed_locks, claimerLockHash],
    };
    tx.addOutput({ lock: packetCell.cellOutput.lock, capacity: inputCap - payout }, encodePacketData(nextPd));
    const moved = tx.outputs[0];
    tx.outputs[0] = tx.outputs[1];
    tx.outputs[1] = moved;
    const d0 = tx.outputsData[0];
    tx.outputsData[0] = tx.outputsData[1];
    tx.outputsData[1] = d0;
  }

  tx.addCellDeps({
    depType: 'code',
    outPoint: { txHash: PCKT_LOCK.txHash, index: PCKT_LOCK.index },
  });
  await tx.completeFeeBy(signer);

  const msg = hashCkb(OutPoint.from(op).toBytes(), bytesFrom(claimerLockHash));
  const sig = secp256k1.sign(bytesFrom(msg), decodePk(claimPrivateKey));
  const sigHex = hexFrom(bytesConcat(sig.toCompactRawBytes(), Uint8Array.from([sig.recovery ?? 0])));
  tx.setWitnessArgsAt(0, WitnessArgs.from({ lock: encodeClaimWitness(sigHex, claimerLockHash) }));

  const signed = await signer.signTransaction(tx);
  const signedJson = JSON.parse(stringify(signed));
  const { tx_hash } = await relayTransaction(signedJson);
  return { txHash: tx_hash, payout };
}
