import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { IconBtn } from '../components/ui/IconBtn';
import { Packet } from '../components/Packet';
import { useWallet } from '../hooks/useWallet';
import type { ClaimedPacket, PacketSummary } from '../api';
import { ownerLabel, packetMoment, packetTypeInfo, toCkb } from '../packets';

type Props = {
  onSend: () => void;
  onClaim: () => void;
  onOpenActivity: () => void;
  sentPackets: PacketSummary[];
  claimedPackets: ClaimedPacket[];
  priceUsd: number | null;
};

type ActivePacket = {
  amount: string;
  kind: string;
  meta: string;
  variant: 'crimson' | 'ink' | 'foil';
  from: string;
  message: string;
};

type LedgerRow = {
  direction: 'in' | 'out';
  title: string;
  meta: string;
  amount: string;
  at: string;
  ts: number;
};

export function Home({ onSend, onClaim, onOpenActivity, sentPackets, claimedPackets, priceUsd }: Props) {
  const { wallet, openConnect, balance } = useWallet();
  const displayName = wallet?.shortAddress ?? 'Guest';
  const initials = wallet?.initials ?? '??';
  const active: ActivePacket[] = sentPackets.slice(0, 6).map(p => {
    const info = packetTypeInfo(p.packet_type);
    return {
      amount: String(Math.floor(Number(p.current_capacity) / 100000000)),
      kind: info.shortLabel,
      meta: `${p.slots_claimed} / ${p.slots_total} claimed`,
      variant: info.variant,
      from: wallet?.shortAddress ?? ownerLabel(p.owner_lock_hash, 'sender'),
      message: p.message_body || '',
    };
  });
  const walletBalanceCkb = balance ? toCkb(balance) : null;
  const lockedCkb = sentPackets.reduce(
    (sum, p) => sum + Math.floor(Number(p.current_capacity) / 100000000),
    0,
  );
  const usd = walletBalanceCkb !== null && priceUsd ? (walletBalanceCkb * priceUsd).toFixed(2) : null;
  const ledger: LedgerRow[] = [
    ...sentPackets.map(p => ({
      direction: 'out' as const,
      title: p.message_body || packetTypeInfo(p.packet_type).label,
      meta: `${packetTypeInfo(p.packet_type).shortLabel} · ${p.slots_claimed}/${p.slots_total} claimed`,
      amount: `-${Math.floor(Number(p.initial_capacity) / 100000000)}`,
      at: new Date(packetMoment(p) * 1000).toLocaleDateString(),
      ts: packetMoment(p),
    })),
    ...claimedPackets.map(p => {
      const amount = p.slot_amount ? Number(p.slot_amount) / 100000000 : 0;
      return {
        direction: 'in' as const,
        title: p.message_body || packetTypeInfo(p.packet_type).label,
        meta: `${packetTypeInfo(p.packet_type).shortLabel} · from ${ownerLabel(p.owner_lock_hash, 'sender')}`,
        amount: `+${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
        at: new Date(p.claim_ts * 1000).toLocaleDateString(),
        ts: p.claim_ts,
      };
    }),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);
  const activeLayout = active.length > 2 ? 'carousel' : 'grid';

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
            {active.length > 0 ? (
              <button
                onClick={onClaim}
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
            ) : (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--fg-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                }}
              >
                0 open
              </div>
            )}
          </div>

          {active.length > 0 ? (
            <div className="pckt-active-scroll" data-layout={activeLayout}>
              {active.map((p, i) => (
                <div
                  key={i}
                  className="pckt-active-card"
                  style={{ flexShrink: 0, width: 160, scrollSnapAlign: 'start' }}
                >
                  <div style={{ aspectRatio: '160 / 226', width: '100%' }}>
                    <Packet
                      width={160}
                      height={226}
                      amount={p.amount}
                      from={p.from}
                      message={p.message}
                      variant={p.variant}
                      style={{ width: '100%', height: '100%' }}
                    />
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
          ) : (
            <SectionEmpty
              title="No active packets yet"
              body="Seal a packet and it will show up here while claims are still open."
              cta="Send packet"
              onClick={wallet ? onSend : openConnect}
            />
          )}
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
            {ledger.length > 0 && (
              <button
                onClick={onOpenActivity}
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
            )}
          </div>

          {ledger.length > 0 ? (
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
          ) : (
            <SectionEmpty
              title="No history yet"
              body="Claims you receive and packets you send will collect here as they happen."
              cta={wallet ? 'Send packet' : 'Connect wallet'}
              onClick={wallet ? onSend : openConnect}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function SectionEmpty({
  title,
  body,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="pckt-empty-panel">
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          letterSpacing: '-0.02em',
          color: 'var(--fg)',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--fg-muted)',
          lineHeight: 1.6,
          maxWidth: 360,
        }}
      >
        {body}
      </div>
      <Button variant="ghost" size="md" onClick={onClick}>
        {cta}
      </Button>
    </div>
  );
}
