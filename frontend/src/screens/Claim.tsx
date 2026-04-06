import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Packet } from '../components/Packet';

type Props = { onOpen: () => void };

export function Claim({ onOpen }: Props) {
  const [opened, setOpened] = useState(false);

  return (
    <div className="pckt-claim-wrap">
      <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', marginBottom: 12 }}>
        A packet for you
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 36,
          letterSpacing: '-0.02em',
          marginBottom: 4,
          color: 'var(--fg)',
        }}
      >
        <em style={{ fontStyle: 'italic' }}>from</em> shen.bit
      </div>
      <div style={{ fontSize: 14, color: 'var(--fg-muted)', marginBottom: 28 }}>
        “Fold · Seal · Send”
      </div>

      <div
        className="pckt-claim-packet"
        style={{
          animation: opened ? 'none' : 'pckt-float 3.6s ease-in-out infinite',
          transition: 'transform 400ms var(--ease-out)',
        }}
      >
        <Packet
          width={260}
          height={368}
          amount={opened ? '56' : '888'}
          from="shen.bit"
          message="Fold · Seal · Send"
          status={opened ? 'claimed' : 'sealed'}
        />
      </div>

      <div style={{ marginTop: 36, width: '100%', maxWidth: 360 }}>
        {!opened ? (
          <>
            <Button
              variant="primary"
              size="lg"
              full
              icon="sparkle"
              onClick={() => setOpened(true)}
            >
              Open packet
            </Button>
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--fg-quiet)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '.08em',
                textAlign: 'center',
              }}
            >
              8 of 20 slots remain · random split
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 48,
                color: 'var(--crimson-600)',
                letterSpacing: '-0.02em',
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              +56 CKB
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--fg-muted)',
                marginBottom: 18,
                textAlign: 'center',
              }}
            >
              Settled to your wallet.
            </div>
            <Button
              variant="primary"
              size="lg"
              full
              iconRight="arrow_right"
              onClick={onOpen}
            >
              View in wallet
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
