import {
  CellOutput,
  bytesConcat,
  bytesFrom,
  hashCkb,
  type HexLike,
  type ScriptLike,
} from '@ckb-ccc/connector-react';
import type { PacketSummary } from './api';
import {
  CELL_OVERHEAD_BYTES,
  MIN_SLOT_SHANNONS,
  PD_FIXED_BYTES,
  PD_HEADER_BYTES,
  SHANNONS_PER_BYTE,
} from './molecule';

const SHANNONS = 100_000_000n;
export const MIN_CLAIM_CELL_SHANNONS = 63_000_000_000n;
export const SAFE_SLOT_PAYOUT_SHANNONS = 70_000_000_000n;

export type PacketTypeInfo = {
  label: string;
  shortLabel: string;
  isTimed: boolean;
  isLucky: boolean;
  variant: 'ink' | 'crimson' | 'foil';
};

export function packetTypeInfo(packetType: number): PacketTypeInfo {
  switch (packetType) {
    case 0:
      return {
        label: 'Fixed packet',
        shortLabel: 'Fixed',
        isTimed: false,
        isLucky: false,
        variant: 'ink',
      };
    case 1:
      return {
        label: 'Lucky packet',
        shortLabel: 'Lucky',
        isTimed: false,
        isLucky: true,
        variant: 'crimson',
      };
    case 2:
      return {
        label: 'Timed fixed packet',
        shortLabel: 'Timed',
        isTimed: true,
        isLucky: false,
        variant: 'foil',
      };
    case 3:
      return {
        label: 'Timed lucky packet',
        shortLabel: 'Timed lucky',
        isTimed: true,
        isLucky: true,
        variant: 'foil',
      };
    default:
      return {
        label: 'Packet',
        shortLabel: 'Packet',
        isTimed: false,
        isLucky: false,
        variant: 'crimson',
      };
  }
}

export function packetMoment(packet: PacketSummary): number {
  return packet.unlock_time > 0 ? packet.unlock_time : packet.expiry;
}

export function toBigInt(value: bigint | number | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

export function toCkb(shannons: bigint): number {
  return Number(shannons) / Number(SHANNONS);
}

export function ownerLabel(ownerLockHash?: string | null, fallback = 'unknown') {
  if (!ownerLockHash) return fallback;
  return `${ownerLockHash.slice(0, 6)}…${ownerLockHash.slice(-4)}`;
}

export function recipientCellCapacity(lock: ScriptLike): bigint {
  return BigInt(CellOutput.from({ lock }, '0x').capacity.toString());
}

export function minimumFixedPacketAmount(slotsTotal: number): bigint {
  return SAFE_SLOT_PAYOUT_SHANNONS * BigInt(slotsTotal);
}

export function packetFloor(slotsTotal: number, messageBody?: string | null): bigint {
  const messageLen = new TextEncoder().encode(messageBody ?? '').length;
  const maxLocks = BigInt(Math.max(0, slotsTotal - 1));
  const pdSize =
    PD_HEADER_BYTES + PD_FIXED_BYTES + (4n + BigInt(messageLen)) + (4n + maxLocks * 32n);
  return (CELL_OVERHEAD_BYTES + pdSize) * SHANNONS_PER_BYTE;
}

export function predictClaimPayout(packet: PacketSummary): bigint {
  const remaining = packet.slots_total - packet.slots_claimed;
  if (remaining <= 0) return 0n;

  const currentCapacity = toBigInt(packet.current_capacity);
  if (remaining === 1) return currentCapacity;

  const info = packetTypeInfo(packet.packet_type);
  if (!info.isLucky) {
    return toBigInt(packet.initial_capacity) / BigInt(packet.slots_total);
  }

  const floor = packetFloor(packet.slots_total, packet.message_body);
  const remainingPool = currentCapacity - floor;
  const mustReserve = MIN_SLOT_SHANNONS * BigInt(remaining - 1);
  const maxForThis = remainingPool > mustReserve ? remainingPool - mustReserve : 0n;
  const avg = remainingPool / BigInt(remaining);
  const upper = avg * 2n < maxForThis ? avg * 2n : maxForThis;
  const lower = MIN_SLOT_SHANNONS;
  const range = upper - lower;
  if (range <= 0n) return lower;
  return lower + (slotSeed(packet.salt ?? '0x', packet.slots_claimed) % range);
}

function slotSeed(salt: HexLike, slotIndex: number): bigint {
  const digest = bytesFrom(hashCkb(bytesConcat(bytesFrom(salt), Uint8Array.from([slotIndex]))));
  let out = 0n;
  for (let i = 0; i < 8; i += 1) {
    out |= BigInt(digest[i] ?? 0) << BigInt(i * 8);
  }
  return out;
}
