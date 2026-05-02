import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClaimedPacket, PacketSummary } from '../api';
import { ownerLabel, toCkb } from '../packets';

export type NotifKind = 'claim_in' | 'claim_out' | 'reclaim_ready' | 'fully_claimed';

export type NotifEntry = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  ts: number; // epoch ms
  read: boolean;
  outPoint?: string;
};

type Snapshot = {
  // Per out_point: previous slots_claimed and current_capacity (in shannons string)
  sent: Record<string, { slotsClaimed: number; capacity: string; expiry: number }>;
  expiryNotified: string[];
  claimedSeen: string[];
  feed: NotifEntry[];
  initialized: boolean;
};

const FEED_LIMIT = 80;

function storageKey(lockHash: string) {
  return `pckt:notif:${lockHash}`;
}

function loadSnapshot(lockHash: string): Snapshot {
  try {
    const raw = localStorage.getItem(storageKey(lockHash));
    if (raw) {
      const parsed = JSON.parse(raw) as Snapshot;
      return {
        sent: parsed.sent ?? {},
        expiryNotified: parsed.expiryNotified ?? [],
        claimedSeen: parsed.claimedSeen ?? [],
        feed: parsed.feed ?? [],
        initialized: !!parsed.initialized,
      };
    }
  } catch {}
  return { sent: {}, expiryNotified: [], claimedSeen: [], feed: [], initialized: false };
}

function persistSnapshot(lockHash: string, snap: Snapshot) {
  try {
    localStorage.setItem(storageKey(lockHash), JSON.stringify(snap));
  } catch {}
}

function fireSystemNotification(title: string, body: string, tag?: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: '/favicon.svg' });
  } catch {
    // Some browsers throw when constructing on unsupported contexts; ignore.
  }
}

function makeId(prefix: string, ts: number): string {
  return `${prefix}-${ts}-${Math.random().toString(36).slice(2, 8)}`;
}

function ckbAmount(shannons: bigint): string {
  return toCkb(shannons).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/**
 * Watches sent + claimed packet lists for state transitions and surfaces
 * both native browser notifications and an in-app feed.
 *
 * State is persisted in localStorage keyed by lockHash, so reloads don't
 * re-dump baseline events as fresh notifications.
 */
export function useNotifications(opts: {
  sentPackets: PacketSummary[];
  claimedPackets: ClaimedPacket[];
  lockHash: string | null;
}) {
  const { sentPackets, claimedPackets, lockHash } = opts;
  const [feed, setFeed] = useState<NotifEntry[]>([]);
  const snapRef = useRef<Snapshot | null>(null);
  const lockRef = useRef<string | null>(null);
  // Per-session flag (resets every page load). On the first sync after the
  // app mounts we silently reconcile state without firing OS notifications,
  // so reloads never replay accumulated chain activity as a notification dump.
  const firstSyncRef = useRef<Record<string, boolean>>({});

  // Load persisted snapshot when wallet (lockHash) changes.
  useEffect(() => {
    if (!lockHash) {
      snapRef.current = null;
      lockRef.current = null;
      setFeed([]);
      return;
    }
    if (lockRef.current !== lockHash) {
      const snap = loadSnapshot(lockHash);
      snapRef.current = snap;
      lockRef.current = lockHash;
      if (firstSyncRef.current[lockHash] === undefined) {
        firstSyncRef.current[lockHash] = true;
      }
      setFeed(snap.feed);
    }
  }, [lockHash]);

  // Diff & fire whenever the lists update.
  useEffect(() => {
    if (!lockHash) return;
    const snap = snapRef.current;
    if (!snap) return;

    const now = Math.floor(Date.now() / 1000);
    const newEntries: NotifEntry[] = [];
    // True only the first time this hook syncs state during the current page
    // session, regardless of whether persisted state already exists. Used to
    // suppress OS notifications on reload (so the user doesn't get a dump).
    const isFirstSyncThisSession = firstSyncRef.current[lockHash] !== false;
    firstSyncRef.current[lockHash] = false;

    // First sync ever for this wallet — snapshot silently as baseline.
    if (!snap.initialized) {
      for (const p of sentPackets) {
        snap.sent[p.out_point] = {
          slotsClaimed: p.slots_claimed,
          capacity: p.current_capacity,
          expiry: p.expiry,
        };
        if (p.expiry <= now && p.slots_claimed < p.slots_total) {
          if (!snap.expiryNotified.includes(p.out_point)) snap.expiryNotified.push(p.out_point);
        }
      }
      for (const c of claimedPackets) {
        if (!snap.claimedSeen.includes(c.out_point)) snap.claimedSeen.push(c.out_point);
      }
      snap.initialized = true;
      persistSnapshot(lockHash, snap);
      return;
    }

    // --- Sent packets: detect new claims and fresh expiries.
    const seenSent = new Set<string>();
    for (const p of sentPackets) {
      seenSent.add(p.out_point);
      const prev = snap.sent[p.out_point];

      if (!prev) {
        snap.sent[p.out_point] = {
          slotsClaimed: p.slots_claimed,
          capacity: p.current_capacity,
          expiry: p.expiry,
        };
        continue;
      }

      if (p.slots_claimed > prev.slotsClaimed) {
        const delta = p.slots_claimed - prev.slotsClaimed;
        const remaining = Math.max(0, p.slots_total - p.slots_claimed);
        let amountStr: string | null = null;
        try {
          const drained = BigInt(prev.capacity) - BigInt(p.current_capacity);
          if (drained > 0n) amountStr = ckbAmount(drained);
        } catch {}

        const ts = Date.now();
        const id = makeId('claim_out', ts);
        const isFinal = remaining === 0;
        const title = delta === 1
          ? (isFinal ? 'Your packet is fully opened' : 'Someone opened your packet')
          : `${delta} more claims on your packet`;
        const body = (() => {
          const parts: string[] = [];
          if (amountStr) parts.push(`+${amountStr} CKB just claimed`);
          parts.push(
            isFinal
              ? `All ${p.slots_total} slots are now open.`
              : `${remaining} of ${p.slots_total} slots remain.`,
          );
          if (p.message_body) parts.push(`"${p.message_body}"`);
          return parts.join(' · ');
        })();

        // On the first sync of a session we don't have a real per-claim
        // timestamp (the indexer doesn't expose one for sender-side claims),
        // so we add a quiet, pre-read entry rather than fire an OS notif.
        newEntries.push({ id, kind: isFinal ? 'fully_claimed' : 'claim_out', title, body, ts, read: isFirstSyncThisSession, outPoint: p.out_point });
        if (!isFirstSyncThisSession) {
          fireSystemNotification(title, body, `pckt:claim:${p.out_point}:${p.slots_claimed}`);
        }

        snap.sent[p.out_point] = {
          slotsClaimed: p.slots_claimed,
          capacity: p.current_capacity,
          expiry: p.expiry,
        };
      } else {
        // Keep capacity/expiry fresh even when slots_claimed didn't change.
        snap.sent[p.out_point].capacity = p.current_capacity;
        snap.sent[p.out_point].expiry = p.expiry;
      }

      if (
        p.expiry <= now &&
        p.slots_claimed < p.slots_total &&
        !snap.expiryNotified.includes(p.out_point)
      ) {
        snap.expiryNotified.push(p.out_point);
        const leftover = Math.max(0, p.slots_total - p.slots_claimed);
        // Use the on-chain expiry as the canonical event timestamp so the
        // feed reads "expired 2h ago" rather than "just now".
        const ts = p.expiry * 1000;
        const title = 'Time to reclaim';
        let amountStr: string | null = null;
        try {
          amountStr = ckbAmount(BigInt(p.current_capacity));
        } catch {}
        const body = amountStr
          ? `Your packet expired with ${amountStr} CKB and ${leftover} unclaimed slot${leftover === 1 ? '' : 's'} inside. Tap to reclaim.`
          : `Your packet expired with ${leftover} unclaimed slot${leftover === 1 ? '' : 's'}. Tap to reclaim.`;
        newEntries.push({ id: makeId('reclaim', ts), kind: 'reclaim_ready', title, body, ts, read: isFirstSyncThisSession, outPoint: p.out_point });
        if (!isFirstSyncThisSession) {
          fireSystemNotification(title, body, `pckt:reclaim:${p.out_point}`);
        }
      }
    }

    // Drop entries from the persisted sent map that have disappeared from the
    // API (e.g. packet pruned). Keeps the snapshot from growing unbounded.
    for (const k of Object.keys(snap.sent)) {
      if (!seenSent.has(k)) delete snap.sent[k];
    }

    // --- Claimed packets: first time seeing a claimed entry for this wallet.
    const seenClaimed = new Set(snap.claimedSeen);
    for (const c of claimedPackets) {
      if (seenClaimed.has(c.out_point)) continue;
      seenClaimed.add(c.out_point);
      snap.claimedSeen.push(c.out_point);

      const amount = c.slot_amount ? toCkb(BigInt(c.slot_amount)) : 0;
      const from = ownerLabel(c.owner_lock_hash, 'someone', c.owner_address, c.owner_name);
      // Prefer the indexer-recorded claim time so reloads keep the real ts.
      const ts = c.claim_ts ? c.claim_ts * 1000 : Date.now();
      const title = amount > 0 ? `+${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} CKB landed` : 'You opened a packet';
      const messagePart = c.message_body ? ` · "${c.message_body}"` : '';
      const body = amount > 0
        ? `From ${from}${messagePart}`
        : `Settled to your wallet from ${from}.${messagePart}`;
      newEntries.push({ id: makeId('claim_in', ts), kind: 'claim_in', title, body, ts, read: isFirstSyncThisSession, outPoint: c.out_point });
      if (!isFirstSyncThisSession) {
        fireSystemNotification(title, body, `pckt:claim_in:${c.out_point}`);
      }
    }

    if (newEntries.length > 0) {
      snap.feed = [...newEntries, ...snap.feed]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, FEED_LIMIT);
      setFeed(snap.feed);
    }
    persistSnapshot(lockHash, snap);
  }, [sentPackets, claimedPackets, lockHash]);

  const markAllRead = useCallback(() => {
    if (!lockHash) return;
    const snap = snapRef.current;
    if (!snap) return;
    snap.feed = snap.feed.map(e => (e.read ? e : { ...e, read: true }));
    persistSnapshot(lockHash, snap);
    setFeed(snap.feed);
  }, [lockHash]);

  const clearAll = useCallback(() => {
    if (!lockHash) return;
    const snap = snapRef.current;
    if (!snap) return;
    snap.feed = [];
    persistSnapshot(lockHash, snap);
    setFeed([]);
  }, [lockHash]);

  const unreadCount = feed.reduce((n, e) => n + (e.read ? 0 : 1), 0);

  return { feed, unreadCount, markAllRead, clearAll };
}

export function notificationsAllowed(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
