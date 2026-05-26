import { useState } from 'react';
import { Chip } from '../components/ui/Chip';
import type { PacketSummary } from '../api';

type LedgerRow = {
  direction: 'in' | 'out';
  kind: 'Lucky' | 'Fixed' | 'Timed' | 'Claim' | 'Refund';
  title: string;
  meta: string;
  amount: string;
  at: string;
  group: 'today' | 'week' | 'earlier';
};

type Filter = 'all' | 'sent' | 'received';

const groupLabels: Record<LedgerRow['group'], string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

export function Activity({ packets }: { packets: PacketSummary[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now() / 1000;
  const rows: LedgerRow[] = packets.map(p => {
    const kind: LedgerRow['kind'] = p.packet_type === 1 ? 'Fixed' : p.packet_type === 2 ? 'Timed' : 'Lucky';
    const ageDays = (now - p.unlock_time) / 86400;
    return {
      direction: 'out',
      kind,
      title: `${kind} packet`,
      meta: `${p.slots_claimed}/${p.slots_total} claimed`,
      amount: `-${Math.floor(Number(p.initial_capacity) / 100000000)}`,
      at: new Date(p.unlock_time * 1000).toLocaleDateString(),
      group: ageDays < 1 ? 'today' : ageDays < 7 ? 'week' : 'earlier',
    };
  });

  const visible = rows.filter(r => {
    if (filter === 'sent') return r.direction === 'out';
    if (filter === 'received') return r.direction === 'in';
    return true;
  });

  const totalSent = rows
    .filter(r => r.direction === 'out')
    .reduce((sum, r) => sum + Number(r.amount.replace(/[^\d-]/g, '')), 0);
  const totalReceived = rows
    .filter(r => r.direction === 'in')
    .reduce((sum, r) => sum + Number(r.amount.replace(/[^\d-]/g, '')), 0);

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
          Everything you've sent, claimed, and received.
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
          <Summary label="Received" value={`${totalReceived.toLocaleString()} CKB`} tint="ok" />
        </div>
      </section>

      <div style={{ display: 'flex', gap: 6, padding: '16px 20px 0', flexWrap: 'wrap' }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        <Chip active={filter === 'sent'} onClick={() => setFilter('sent')}>
          Sent
        </Chip>
        <Chip active={filter === 'received'} onClick={() => setFilter('received')}>
          Received
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
