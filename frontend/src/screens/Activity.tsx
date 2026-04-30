import { useState } from 'react';
import { Chip } from '../components/ui/Chip';
import type { ClaimedPacket, PacketSummary } from '../api';
import { ownerLabel, packetMoment, packetTypeInfo } from '../packets';

type LedgerRow = {
  direction: 'in' | 'out';
  kind: string;
  title: string;
  meta: string;
  amount: string;
  at: string;
  group: 'today' | 'week' | 'earlier';
};

type Filter = 'all' | 'sent' | 'claimed';

const groupLabels: Record<LedgerRow['group'], string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

function ageGroup(ageDays: number): LedgerRow['group'] {
  if (ageDays < 1) return 'today';
  if (ageDays < 7) return 'week';
  return 'earlier';
}

export function Activity({
  sentPackets,
  claimedPackets,
}: {
  sentPackets: PacketSummary[];
  claimedPackets: ClaimedPacket[];
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const nowMs = Date.now();
  const rows: LedgerRow[] = [
    ...sentPackets.map(p => {
      const kind = packetTypeInfo(p.packet_type).shortLabel;
      const tsMs = (p.sealed_at ?? packetMoment(p)) * 1000;
      const ageDays = (nowMs - tsMs) / 86400000;
      return {
        direction: 'out' as const,
        kind,
        title: p.message_body || packetTypeInfo(p.packet_type).label,
        meta: `${kind} · ${p.slots_claimed}/${p.slots_total} claimed`,
        amount: `-${Math.floor(Number(p.initial_capacity) / 100000000)}`,
        at: new Date(tsMs).toLocaleDateString(),
        group: ageGroup(ageDays),
      };
    }),
    ...claimedPackets.map(p => {
      const kind = packetTypeInfo(p.packet_type).shortLabel;
      const ageDays = (nowMs - p.claim_ts) / 86400000;
      const slotCkb = p.slot_amount ? Number(p.slot_amount) / 100000000 : 0;
      return {
        direction: 'in' as const,
        kind,
        title: p.message_body || packetTypeInfo(p.packet_type).label,
        meta: `${kind} · from ${ownerLabel(p.owner_lock_hash, 'sender')}`,
        amount: `+${slotCkb.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
        at: new Date(p.claim_ts).toLocaleDateString(),
        group: ageGroup(ageDays),
      };
    }),
  ];

  const visible = rows.filter(r => {
    if (filter === 'sent') return r.direction === 'out';
    if (filter === 'claimed') return r.direction === 'in';
    return true;
  });

  const totalSent = rows
    .filter(r => r.direction === 'out')
    .reduce((sum, r) => sum + Number(r.amount.replace(/[^\d-]/g, '')), 0);
  const claimedCount = claimedPackets.length;

  const groups: LedgerRow['group'][] = ['today', 'week', 'earlier'];

  return (
    <div className="pckt-page">
      <header className="pckt-page-header">
        <h1
          className="pckt-section-title"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 32,
            letterSpacing: '-0.02em',
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          Activity
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: '6px 0 0' }}>
          Live history for the packets you've sealed and the packets you've claimed.
        </p>
      </header>

      <section style={{ padding: '16px 20px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <Summary label="Sent" value={`${Math.abs(totalSent).toLocaleString()} CKB`} />
          <Summary label="Claimed" value={`${claimedCount.toLocaleString()} packets`} tint="ok" />
        </div>
      </section>

      <div style={{ display: 'flex', gap: 6, padding: '16px 20px 0', flexWrap: 'wrap' }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        <Chip active={filter === 'sent'} onClick={() => setFilter('sent')}>
          Sent
        </Chip>
        <Chip active={filter === 'claimed'} onClick={() => setFilter('claimed')}>
          Claimed
        </Chip>
      </div>

      <div style={{ paddingBottom: 24 }}>
        {groups.map(g => {
          const items = visible.filter(r => r.group === g);
          if (items.length === 0) return null;
          return (
            <section key={g}>
              <div
                style={{
                  padding: '20px 20px 8px',
                  fontSize: 11,
                  color: 'var(--fg-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '.15em',
                  textTransform: 'uppercase',
                }}
              >
                {groupLabels[g]}
              </div>
              <div>
                {items.map((row, i) => (
                  <div
                    key={`${g}-${i}`}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background:
                          row.direction === 'in'
                            ? 'rgba(74,138,92,.12)'
                            : 'var(--accent-weak)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color:
                          row.direction === 'in'
                            ? 'var(--ok)'
                            : 'var(--crimson-600)',
                        fontSize: 14,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {row.direction === 'in' ? '↓' : '↑'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'var(--fg)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--fg-muted)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.meta}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 20,
                          color: row.direction === 'in' ? 'var(--ok)' : 'var(--fg)',
                        }}
                      >
                        {row.amount}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--fg-quiet)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                        }}
                      >
                        {row.at}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {visible.length === 0 && (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--fg-muted)',
              fontSize: 14,
            }}
          >
            Nothing matches that filter.
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value, tint }: { label: string; value: string; tint?: 'ok' }) {
  return (
    <div style={{ background: 'var(--bg-elev)', padding: '14px 16px' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          color: tint === 'ok' ? 'var(--ok)' : 'var(--fg)',
          letterSpacing: '-0.01em',
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
