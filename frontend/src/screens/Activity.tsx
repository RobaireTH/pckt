import { useState } from 'react';
import { Chip } from '../components/ui/Chip';

type LedgerRow = {
  direction: 'in' | 'out';
  kind: 'Lucky' | 'Fixed' | 'Timed' | 'Claim' | 'Refund';
  title: string;
  meta: string;
  amount: string;
  at: string;
  group: 'today' | 'week' | 'earlier';
};

const rows: LedgerRow[] = [
  { direction: 'out', kind: 'Lucky', title: 'Family group · Lucky', meta: 'Sent to 20 recipients · 12 claimed', amount: '−888', at: '2h ago', group: 'today' },
  { direction: 'in',  kind: 'Claim', title: 'Claimed · mei.bit', meta: 'From 0xa3…3x4e', amount: '+128', at: '5h ago', group: 'today' },
  { direction: 'out', kind: 'Fixed', title: 'Birthday · Fixed', meta: 'Sent to 5 recipients · 3 claimed', amount: '−250', at: 'Yesterday', group: 'week' },
  { direction: 'in',  kind: 'Claim', title: 'Claimed · kai.bit', meta: 'From 0x9b…21fa', amount: '+56',  at: 'Apr 22', group: 'week' },
  { direction: 'out', kind: 'Timed', title: 'Countdown · Timed unlock', meta: 'Sent to 12 recipients · unlocks Apr 26', amount: '−2000', at: 'Apr 21', group: 'week' },
  { direction: 'in',  kind: 'Claim', title: 'Claimed · shen.bit', meta: 'From 0x4f…8a12', amount: '+220', at: 'Apr 19', group: 'week' },
  { direction: 'out', kind: 'Fixed', title: 'Coffee run · Fixed', meta: 'Sent to 3 recipients · all claimed', amount: '−75', at: 'Apr 14', group: 'earlier' },
  { direction: 'in',  kind: 'Refund', title: 'Refund · expired packet', meta: '2 unclaimed slots returned', amount: '+80', at: 'Apr 12', group: 'earlier' },
  { direction: 'in',  kind: 'Claim', title: 'Claimed · rin.bit', meta: 'From 0x1a…5c9d', amount: '+40', at: 'Apr 11', group: 'earlier' },
  { direction: 'out', kind: 'Lucky', title: 'Team bonus · Lucky', meta: 'Sent to 8 recipients · 8 claimed', amount: '−500', at: 'Apr 8', group: 'earlier' },
];

type Filter = 'all' | 'sent' | 'received';

const groupLabels: Record<LedgerRow['group'], string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

export function Activity() {
  const [filter, setFilter] = useState<Filter>('all');

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
