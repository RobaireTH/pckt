import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { IconBtn } from '../components/ui/IconBtn';
import { Packet } from '../components/Packet';
import { useWallet } from '../hooks/useWallet';
import type { PacketSummary } from '../api';
import { packetMoment, packetTypeInfo, toCkb } from '../packets';

type Props = {
  onSend: () => void;
  onClaim: () => void;
  packets: PacketSummary[];
  priceUsd: number | null;
};

type ActivePacket = {
  amount: string;
  kind: string;
  meta: string;
  variant: 'crimson' | 'ink' | 'foil';
};

type LedgerRow = {
  direction: 'in' | 'out';
  title: string;
  meta: string;
  amount: string;
  at: string;
};

export function Home({ onSend, onClaim, packets, priceUsd }: Props) {
  const { wallet, openConnect, balance } = useWallet();
  const displayName = wallet?.shortAddress ?? 'Guest';
  const initials = wallet?.initials ?? '??';
  const active: ActivePacket[] = packets.slice(0, 6).map(p => {
    const info = packetTypeInfo(p.packet_type);
    return {
      amount: String(Math.floor(Number(p.current_capacity) / 100000000)),
      kind: info.shortLabel,
      meta: `${p.slots_claimed} / ${p.slots_total} claimed`,
      variant: info.variant,
    };
  });
  const walletBalanceCkb = balance ? toCkb(balance) : null;
  const lockedCkb = packets.reduce(
    (sum, p) => sum + Math.floor(Number(p.current_capacity) / 100000000),
    0,
  );
  const usd = walletBalanceCkb !== null && priceUsd ? (walletBalanceCkb * priceUsd).toFixed(2) : null;
  const ledger: LedgerRow[] = packets.slice(0, 8).map(p => ({
    direction: 'out',
    title: packetTypeInfo(p.packet_type).label,
    meta: `${p.slots_claimed}/${p.slots_total} claimed`,
    amount: `-${Math.floor(Number(p.initial_capacity) / 100000000)}`,
    at: new Date(packetMoment(p) * 1000).toLocaleDateString(),
  }));

  return (
    <div>
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
              {wallet && walletBalanceCkb !== null
                ? walletBalanceCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : '—'}
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
            {wallet
              ? `${usd ? `≈ $${usd} USD` : 'Price unavailable'} · ${lockedCkb.toLocaleString()} CKB locked in packets`
              : 'Connect a wallet to see your balance'}
          </div>
        </div>

        <div className="pckt-home-actions">
          {wallet ? (
            <>
              <Button variant="primary" size="lg" icon="plus" onClick={onSend}>
                Send packet
              </Button>
              <Button variant="ghost" size="lg" icon="inbox" onClick={onClaim}>
                View packets
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" icon="wallet" onClick={openConnect}>
              Connect wallet
            </Button>
          )}
        </div>
      </section>

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
