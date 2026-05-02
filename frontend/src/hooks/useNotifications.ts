import { useEffect, useRef } from 'react';
import type { ClaimedPacket, PacketSummary } from '../api';
import { ownerLabel, toCkb } from '../packets';

type State = {
  // out_point -> snapshot
  sentClaims: Map<string, number>;
  sentExpiryNotified: Set<string>;
  claimedSeen: Set<string>;
  initialized: boolean;
};

function notify(title: string, body: string, tag?: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: '/favicon.svg' });
  } catch {
    // Some browsers throw when constructing on unsupported contexts; ignore.
  }
}

/**
 * Watches sent + claimed packet lists for state transitions and surfaces
 * native browser notifications when something the user cares about happens.
 *
 * - First load is treated as a baseline: nothing fires.
 * - New claim on a sent packet -> "Your packet was opened".
 * - Sent packet hits expiry while still owed -> "Reclaim available".
 * - First time a claimed packet appears for this wallet -> "You opened a packet".
 */
export function useNotifications(opts: {
  sentPackets: PacketSummary[];
  claimedPackets: ClaimedPacket[];
  enabled: boolean;
}) {
  const { sentPackets, claimedPackets, enabled } = opts;
  const stateRef = useRef<State>({
    sentClaims: new Map(),
    sentExpiryNotified: new Set(),
    claimedSeen: new Set(),
    initialized: false,
  });

  useEffect(() => {
    if (!enabled) return;
    const s = stateRef.current;
    const now = Math.floor(Date.now() / 1000);

    if (!s.initialized) {
      for (const p of sentPackets) {
        s.sentClaims.set(p.out_point, p.slots_claimed);
        if (p.expiry <= now && p.slots_claimed < p.slots_total) {
          s.sentExpiryNotified.add(p.out_point);
        }
      }
      for (const c of claimedPackets) s.claimedSeen.add(c.out_point);
      s.initialized = true;
      return;
    }

    for (const p of sentPackets) {
      const prev = s.sentClaims.get(p.out_point);
      if (prev === undefined) {
        s.sentClaims.set(p.out_point, p.slots_claimed);
      } else if (p.slots_claimed > prev) {
        const delta = p.slots_claimed - prev;
        const remaining = Math.max(0, p.slots_total - p.slots_claimed);
        notify(
          delta === 1 ? 'Your packet was opened' : `${delta} claims on your packet`,
          remaining > 0
            ? `${remaining} of ${p.slots_total} slots remain.`
            : `All ${p.slots_total} slots are claimed.`,
          `pckt:claimed:${p.out_point}`,
        );
        s.sentClaims.set(p.out_point, p.slots_claimed);
      }

      if (
        p.expiry <= now &&
        p.slots_claimed < p.slots_total &&
        !s.sentExpiryNotified.has(p.out_point)
      ) {
        s.sentExpiryNotified.add(p.out_point);
        const leftover = Math.max(0, p.slots_total - p.slots_claimed);
        notify(
          'Reclaim available',
          `A packet with ${leftover} unclaimed slot${leftover === 1 ? '' : 's'} just expired and can be reclaimed.`,
          `pckt:reclaim:${p.out_point}`,
        );
      }
    }

    for (const c of claimedPackets) {
      if (s.claimedSeen.has(c.out_point)) continue;
      s.claimedSeen.add(c.out_point);
      const amount = c.slot_amount ? toCkb(BigInt(c.slot_amount)) : 0;
      const from = ownerLabel(c.owner_lock_hash, 'someone', c.owner_address, c.owner_name);
      notify(
        'You opened a packet',
        amount > 0
          ? `+${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} CKB from ${from}.`
          : `Settled to your wallet from ${from}.`,
        `pckt:claim:${c.out_point}`,
      );
    }
  }, [sentPackets, claimedPackets, enabled]);
}

export function notificationsAllowed(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
