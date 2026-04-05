import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { IconBtn } from '../components/ui/IconBtn';
import { Packet } from '../components/Packet';
import { useWallet } from '../hooks/useWallet';

type Props = { onSend: () => void; onClaim: () => void };

type ActivePacket = {
  amount: string;
  kind: string;
  meta: string;
  variant: 'crimson' | 'ink' | 'foil';
};

const active: ActivePacket[] = [
  { amount: '888', kind: 'Lucky', meta: '12 / 20 claimed', variant: 'crimson' },
  { amount: '500', kind: 'Fixed', meta: '3 / 5 claimed', variant: 'ink' },
  { amount: '2K', kind: 'Timed', meta: 'unlocks in 02:14', variant: 'crimson' },
];

type LedgerRow = {
  direction: 'in' | 'out';
  title: string;
  meta: string;
  amount: string;
  at: string;
};

const ledger: LedgerRow[] = [
  { direction: 'out', title: 'Family group · Lucky', meta: 'Sent to 20 recipients', amount: '−888', at: '2h' },
  { direction: 'in',  title: 'Claimed · mei.bit',    meta: 'From 0xa3…3x4e',        amount: '+128', at: '1d' },
  { direction: 'out', title: 'Birthday · Fixed',     meta: 'Sent to 5 recipients', amount: '−250', at: 'Apr 14' },
  { direction: 'in',  title: 'Claimed · kai.bit',    meta: 'From 0x9b…21fa',       amount: '+56',  at: 'Apr 11' },
];

export function Home({ onSend, onClaim }: Props) {
  const { wallet, openConnect } = useWallet();
  const displayName = wallet?.shortAddress ?? 'Guest';
  const initials = wallet?.initials ?? '??';

  return (
    <div>
      {/* Header (mobile-only — desktop has the topnav) */}
      <header
        style={{
          padding: '20px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        className="pckt-home-mobile-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={initials} size={40} />
          <div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>Hello,</div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                letterSpacing: '-0.02em',
              }}
            >
              {displayName}
            </div>
          </div>
        </div>
        <IconBtn name="bell" />
      </header>

      <style>{`
        @media (min-width: 900px) { .pckt-home-mobile-header { display: none; } }
      `}</style>

      {/* Hero: balance + actions */}
      <section className="pckt-home-hero">
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--crimson-600)' }}>
            Balance
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
            <span
              className="t-num pckt-home-balance-num"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 60,
                letterSpacing: '-0.03em',
                color: 'var(--fg)',
                lineHeight: 1,
              }}
            >
              {wallet ? '12,840' : '—'}
            </span>
            <span
              style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--fg-muted)' }}
            >
              CKB
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              marginTop: 6,
            }}
          >
            {wallet ? '≈ $128.40 USD' : 'Connect a wallet to see your balance'}
          </div>
        </div>

        <div className="pckt-home-actions">
          {wallet ? (
            <>
              <Button variant="primary" size="lg" icon="plus" onClick={onSend}>
                Send packet
              </Button>
              <Button variant="ghost" size="lg" icon="link" onClick={onClaim}>
                Claim a link
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" icon="wallet" onClick={openConnect}>
              Connect wallet
            </Button>
          )}
        </div>
      </section>

      {/* Grid: Active + Ledger */}
      <div className="pckt-home-grid">
        <section>
          <div
            style={{
              padding: '20px 20px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
            className="pckt-section-head"
          >
            <h2
              className="pckt-section-title"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                letterSpacing: '-0.01em',
                margin: 0,
                fontWeight: 400,
              }}
            >
              Active packets
            </h2>
            <div
              style={{
                fontSize: 11,
                color: 'var(--fg-muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
              }}
            >
              {active.length} open
            </div>
          </div>

          <div className="pckt-active-scroll">
            {active.map((p, i) => (
              <div
                key={i}
                className="pckt-active-card"
                style={{ flexShrink: 0, width: 160, scrollSnapAlign: 'start' }}
              >
                <div style={{ aspectRatio: '160 / 226', width: '100%' }}>
                  <Packet width={160} height={226} amount={p.amount} variant={p.variant} style={{ width: '100%', height: '100%' }} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>
                    {p.kind}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--fg-muted)',
                      fontFamily: 'var(--font-mono)',
                      marginTop: 2,
                    }}
                  >
                    {p.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div
            style={{
              padding: '20px 20px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
            className="pckt-section-head"
          >
            <h2
              className="pckt-section-title"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                letterSpacing: '-0.01em',
                margin: 0,
                fontWeight: 400,
              }}
            >
              Ledger
            </h2>
            <button
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--fg-muted)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              See all →
            </button>
          </div>

          <div>
            {ledger.map((row, i) => (
              <div
                key={i}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  borderTop: '1px solid var(--border)',
                  borderBottom: i === ledger.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background:
                      row.direction === 'in' ? 'rgba(74,138,92,.12)' : 'var(--accent-weak)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: row.direction === 'in' ? 'var(--ok)' : 'var(--crimson-600)',
                    flexShrink: 0,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {row.direction === 'in' ? '↓' : '↑'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
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
                <div style={{ textAlign: 'right' }}>
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
      </div>
    </div>
  );
}
