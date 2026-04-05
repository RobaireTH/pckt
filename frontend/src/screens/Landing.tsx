import { Button } from '../components/ui/Button';
import { LockupHorizontal } from '../components/brand/LockupHorizontal';
import { Packet } from '../components/Packet';

const landingStyles = `
  .pckt-landing-hero {
    display: grid;
    gap: 56px;
    grid-template-columns: 1fr;
    align-items: center;
    padding: 56px 24px 80px;
    max-width: 1180px;
    margin: 0 auto;
  }
  @media (min-width: 900px) {
    .pckt-landing-hero {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 72px;
      padding: 96px 48px 120px;
    }
    .pckt-landing-headline { font-size: 88px !important; }
  }
  .pckt-flash-stage {
    position: relative;
    height: 440px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @media (min-width: 900px) {
    .pckt-flash-stage { height: 520px; }
  }
  .pckt-flash-primary {
    position: relative;
    transform: rotate(-5deg);
    z-index: 1;
    filter: drop-shadow(0 32px 60px rgba(126,20,24,.28));
  }
  .pckt-flash-secondary {
    position: absolute;
    top: 16%;
    left: 58%;
    transform: rotate(8deg);
    z-index: 2;
    filter: drop-shadow(0 28px 48px rgba(11,9,7,.32));
  }
  @media (max-width: 520px) {
    .pckt-flash-primary > * { width: 200px !important; height: 286px !important; }
    .pckt-flash-secondary > * { width: 150px !important; height: 214px !important; }
    .pckt-flash-secondary { left: 54%; }
  }
  .pckt-acts {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    border-top: 1px solid var(--border);
  }
  @media (min-width: 720px) {
    .pckt-acts { grid-template-columns: repeat(3, 1fr); border-top: none; }
    .pckt-acts-item { border-left: 1px solid var(--border); }
    .pckt-acts-item:first-child { border-left: none; }
  }
`;

type Props = { onBegin: () => void; onOpen: () => void };

type Pillar = { eye: string; t: string; d: string };

const pillars: Pillar[] = [
  {
    eye: 'Self-custody',
    t: 'Your keys, your packet.',
    d: 'Funds lock on-chain the moment you seal. pckt never holds them, can’t pause them, and can’t read who you sent to.',
  },
  {
    eye: 'Any CKB wallet',
    t: 'No accounts, no downloads.',
    d: 'Claim with JoyID, UniSat, CKBull — a link opens the one you already use. No sign-up, no bridge.',
  },
  {
    eye: 'Returnable',
    t: 'Unclaimed slots come home.',
    d: 'When a packet expires, anything unclaimed returns to you automatically. Nothing stalls in someone else’s wallet.',
  },
  {
    eye: 'Ritual, not gimmick',
    t: 'Three ways to split a packet.',
    d: 'Fixed, lucky, or timed — the same ways you’ve always split 紅包, now settled in seconds.',
  },
];

export function Landing({ onBegin, onOpen }: Props) {
  return (
    <div
      className="paper-grain"
      style={{ background: 'var(--bg)', color: 'var(--fg)', minHeight: '100dvh' }}
    >
      <style>{landingStyles}</style>

      {/* Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backdropFilter: 'saturate(160%) blur(12px)',
          background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <LockupHorizontal size={22} />
          <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <a
              href="#three-acts"
              style={{
                color: 'var(--fg-muted)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              How it works
            </a>
            <a
              href="#why"
              style={{
                color: 'var(--fg-muted)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Why pckt
            </a>
            <Button variant="primary" size="sm" onClick={onOpen}>
              Open app
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pckt-landing-hero">
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', marginBottom: 22 }}>
            ◆ · pckt — a ritual on-chain
          </div>
          <h1
            className="pckt-landing-headline t-display"
            style={{ fontSize: 56, margin: 0, color: 'var(--fg)' }}
          >
            Give a{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--crimson-600)' }}>red packet</em>{' '}
            that travels.
          </h1>
          <p
            style={{
              fontSize: 17,
              color: 'var(--fg-dim)',
              lineHeight: 1.55,
              margin: '22px 0 32px',
              maxWidth: 520,
            }}
          >
            CKB, sealed in a packet, sent as a link. A centuries-old gesture
            that settles on Nervos CKB in seconds — and is yours to keep.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" iconRight="arrow_right" onClick={onBegin}>
              Send a packet
            </Button>
            <Button variant="ghost" size="lg" onClick={onOpen}>
              Claim a link
            </Button>
          </div>

          {/* Stats strip */}
          <div
            style={{
              marginTop: 56,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              padding: '20px 0',
            }}
          >
            {[
              ['412K', 'packets sent'],
              ['2.1M', 'CKB gifted'],
              ['89s', 'avg. to claim'],
            ].map(([v, l]) => (
              <div key={l}>
                <div
                  className="t-num"
                  style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--fg)' }}
                >
                  {v}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--fg-muted)',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    marginTop: 4,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two flash cards — ported from Direction A landing hero */}
        <div className="pckt-flash-stage">
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '-10% -10% 0 -10%',
              background:
                'radial-gradient(ellipse at 50% 45%, rgba(161,27,32,.10), transparent 65%)',
              pointerEvents: 'none',
            }}
          />
          <div className="pckt-flash-primary">
            <Packet
              width={252}
              height={360}
              amount="888"
              from="shen.bit"
              message="Fold · Seal · Send"
              variant="crimson"
            />
          </div>
          <div className="pckt-flash-secondary">
            <Packet
              width={184}
              height={264}
              amount="128"
              from="0xa3…"
              message="gm"
              variant="ink"
            />
          </div>
        </div>
      </section>

      {/* Three acts */}
      <section
        id="three-acts"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elev)' }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '72px 24px 24px' }}>
          <div className="t-eyebrow" style={{ marginBottom: 14 }}>How it works</div>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 48,
              margin: 0,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
            }}
          >
            Three acts. One ritual.
          </h2>
        </div>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 72px' }}>
          <div className="pckt-acts">
            {[
              ['01', 'Seal', 'Choose an amount, a type, an expiry. Sign once.'],
              ['02', 'Send', 'Drop the link wherever the moment lives — DM, group, QR.'],
              ['03', 'Open', 'Any CKB wallet. No accounts, no custody, no waiting.'],
            ].map(([n, t, d]) => (
              <div key={n} className="pckt-acts-item" style={{ padding: '28px 24px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--crimson-600)',
                    marginBottom: 14,
                    letterSpacing: '.1em',
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 28,
                    color: 'var(--fg)',
                    letterSpacing: '-0.01em',
                    marginBottom: 8,
                  }}
                >
                  {t}
                </div>
                <div style={{ fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
                  {d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why pckt — quiet promises */}
      <section id="why" style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '72px 24px 96px' }}>
          <div className="t-eyebrow" style={{ marginBottom: 16 }}>Why pckt</div>
          <h2
            className="pckt-section-title"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 40,
              margin: 0,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
              maxWidth: 720,
              lineHeight: 1.1,
            }}
          >
            Made for giving —{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--crimson-600)' }}>
              not for apps
            </em>
            .
          </h2>
          <p
            style={{
              fontSize: 16,
              color: 'var(--fg-muted)',
              lineHeight: 1.55,
              margin: '20px 0 40px',
              maxWidth: 560,
            }}
          >
            pckt is a small, intentional tool. No feed, no profile, no streaks — just the gesture,
            sealed well, and the smallest possible seam between you and the people you send to.
          </p>
          <div className="pckt-why-grid">
            {pillars.map(p => (
              <div key={p.t} className="pckt-why-card">
                <div
                  className="t-eyebrow"
                  style={{ color: 'var(--crimson-600)', marginBottom: 10 }}
                >
                  {p.eye}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 24,
                    letterSpacing: '-0.01em',
                    color: 'var(--fg)',
                    marginBottom: 10,
                    lineHeight: 1.2,
                  }}
                >
                  {p.t}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--fg-muted)',
                    lineHeight: 1.6,
                  }}
                >
                  {p.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '28px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-muted)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span>pckt · red packets on Nervos CKB</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
