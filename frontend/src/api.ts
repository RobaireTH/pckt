import { BACKEND_URL } from './config';

export type PacketSummary = {
  out_point: string;
  packet_type: number;
  slots_total: number;
  slots_claimed: number;
  initial_capacity: string;
  current_capacity: string;
  expiry: number;
  unlock_time: number;
  owner_lock_hash: string;
  claim_pubkey_hash: string;
  salt: string;
  message_body: string | null;
};

export type PacketEvent = {
  event_type: string;
  tx_hash: string;
  block_number: number;
  ts: number;
  claimer_lock_hash: string | null;
  slot_amount: string | null;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function fetchPackets(ownerLockHash?: string): Promise<PacketSummary[]> {
  const q = ownerLockHash ? `?owner=${encodeURIComponent(ownerLockHash)}` : '';
  return get(`/v1/packets${q}`);
}

export function fetchPacket(outPoint: string): Promise<PacketSummary> {
  return get(`/v1/packets/${encodeURIComponent(outPoint)}`);
}

export function fetchPacketEvents(outPoint: string): Promise<PacketEvent[]> {
  return get(`/v1/packets/${encodeURIComponent(outPoint)}/events`);
}

export function fetchPacketByPubkey(hash: string): Promise<PacketSummary> {
  return get(`/v1/packets/by-pubkey/${encodeURIComponent(hash)}`);
}

export function relayTransaction(signedTx: unknown): Promise<{ tx_hash: string }> {
  return post('/v1/relay/tx', { signed_tx: signedTx });
}

export function createShortlink(
  target: string,
  ttl?: number,
): Promise<{ slug: string; short_url: string }> {
  return post('/v1/links', { target, ttl });
}

export function fetchCkbPrice(): Promise<{ usd: number }> {
  return get('/v1/prices/ckb');
}
