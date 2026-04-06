import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Packet } from '../components/Packet';
import type { Draft } from './CreateAmount';

type Props = {
  draft: Draft;
  onAnother: () => void;
  onHome: () => void;
};

export function CreateShare({ draft, onAnother, onHome }: Props) {
  const { amount, message, slots } = draft;
  const [shareId] = useState(() =>
    Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6),
  );
  const link = `pckt.app/c/${shareId}`;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {},
    );
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'A pckt for you', text: message, url: `https://${link}` });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <div className="pckt-share-wrap">
      <div
        className="t-eyebrow"
        style={{ color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Icon name="check" size={14} stroke={2} />
        Sealed
      </div>
      <h1
        className="pckt-section-title"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 32,
          letterSpacing: '-0.02em',
          color: 'var(--fg)',
          margin: '8px 0 6px',
        }}
      >
        Your packet is ready
      </h1>
      <p
        style={{
          fontSize: 14,
          color: 'var(--fg-muted)',
          lineHeight: 1.55,
          maxWidth: 440,
          margin: 0,
        }}
      >
        Share this link with anyone. The first {slots} claims get a slice of {amount} CKB.
      </p>

      <div className="pckt-share-packet">
        <Packet
          width={240}
          height={340}
          amount={amount || '0'}
          from="shen.bit"
          message={message}
          variant="foil"
        />
      </div>

      <div className="pckt-share-card">
        <div className="pckt-share-link">
          <div
            style={{
              fontSize: 10,
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '.15em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Claim link
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              color: 'var(--fg)',
              wordBreak: 'break-all',
            }}
          >
            {link}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
          <Button
            variant={copied ? 'secondary' : 'primary'}
            size="lg"
            icon={copied ? 'check' : 'copy'}
            onClick={copy}
            full
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button variant="ghost" size="lg" icon="share" onClick={share} full>
            Share
          </Button>
        </div>
      </div>

      <div className="pckt-share-qr">
        <QRBox value={link} size={180} />
        <div
          style={{
            fontSize: 12,
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '.04em',
            textAlign: 'center',
            maxWidth: 220,
          }}
        >
          Or scan to claim — works in any wallet that reads pckt links.
        </div>
      </div>

      <div className="pckt-share-footer">
        <Button variant="ghost" size="lg" icon="plus" onClick={onAnother}>
          Send another
        </Button>
        <Button variant="primary" size="lg" iconRight="arrow_right" onClick={onHome}>
          Back to home
        </Button>
      </div>
    </div>
  );
}

function QRBox({ value, size = 180 }: { value: string; size?: number }) {
  const N = 23;
  const cell = size / N;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const rnd = (k: number) => {
    let x = Math.imul(hash ^ (k * 2654435761), 2246822507);
    x ^= x >>> 13;
    return (x & 1) === 1;
  };
  const inFinder = (i: number, j: number) => {
    const z = (a: number, b: number) => i >= a && i < a + 7 && j >= b && j < b + 7;
    return z(0, 0) || z(0, N - 7) || z(N - 7, 0);
  };
  const cells: JSX.Element[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (inFinder(i, j)) continue;
      if (rnd(i * N + j + 1)) {
        cells.push(
          <rect
            key={`${i}-${j}`}
            x={j * cell}
            y={i * cell}
            width={cell}
            height={cell}
            fill="currentColor"
          />,
        );
      }
    }
  }
  const finder = (i: number, j: number, key: string) => (
    <g key={key}>
      <rect x={j * cell} y={i * cell} width={cell * 7} height={cell * 7} fill="currentColor" />
      <rect
        x={(j + 1) * cell}
        y={(i + 1) * cell}
        width={cell * 5}
        height={cell * 5}
        fill="var(--bg-elev)"
      />
      <rect
        x={(j + 2) * cell}
        y={(i + 2) * cell}
        width={cell * 3}
        height={cell * 3}
        fill="currentColor"
      />
    </g>
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ color: 'var(--fg)', borderRadius: 12 }}
    >
      <rect width={size} height={size} fill="var(--bg-elev)" />
      {cells}
      {finder(0, 0, 'tl')}
      {finder(0, N - 7, 'tr')}
      {finder(N - 7, 0, 'bl')}
    </svg>
  );
}
