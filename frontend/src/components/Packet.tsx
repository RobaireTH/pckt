import { CSSProperties } from 'react';
import { Wordmark } from './brand/Wordmark';

type Variant = 'crimson' | 'ink' | 'foil';
type Status = 'sealed' | 'opening' | 'claimed' | 'empty';

type Props = {
  width?: number;
  height?: number;
  amount?: string;
  unit?: string;
  from?: string;
  message?: string;
  variant?: Variant;
  status?: Status;
  style?: CSSProperties;
  sealLabel?: string;
};

const VARIANTS: Record<
  Variant,
  { bg: string; accent: string; text: string; dim: string; border: string }
> = {
  crimson: {
    bg: 'linear-gradient(155deg, #7e1418 0%, #a11b20 45%, #5a0d10 100%)',
    accent: 'var(--foil, #d4b46a)',
    text: '#fbf8f2',
    dim: 'rgba(251,248,242,.65)',
    border: 'rgba(212,180,106,.35)',
  },
  ink: {
    bg: 'linear-gradient(155deg, #1c1814 0%, #2a2520 50%, #0b0907 100%)',
    accent: 'var(--foil, #d4b46a)',
    text: '#fbf8f2',
    dim: 'rgba(251,248,242,.55)',
    border: 'rgba(212,180,106,.2)',
  },
  foil: {
    bg: 'linear-gradient(155deg,#d4b46a 0%, #f5e8c6 45%, #b8923d 100%)',
    accent: 'var(--crimson-600)',
    text: '#14110e',
    dim: 'rgba(20,17,14,.55)',
    border: 'rgba(20,17,14,.2)',
  },
};

export function Packet({
  width = 280,
  height = 400,
  amount = '888',
  unit = 'CKB',
  from = 'shen.bit',
  message = 'Happy Lunar New Year',
  variant = 'crimson',
  status = 'sealed',
  style,
  sealLabel = '◆',
}: Props) {
  const v = VARIANTS[variant];
  const hasRip = status === 'claimed' || status === 'opening' || status === 'empty';
  const corners: Array<['t' | 'b', 'l' | 'r']> = [
    ['t', 'l'],
    ['t', 'r'],
    ['b', 'l'],
    ['b', 'r'],
  ];

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 14,
        background: v.bg,
        boxShadow: '0 24px 60px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.03)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(rgba(0,0,0,.12) 1px, transparent 1.3px), radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)',
          backgroundSize: '4px 4px, 9px 9px',
          mixBlendMode: 'overlay',
          opacity: 0.5,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 10,
          border: `1px solid ${v.border}`,
          borderRadius: 8,
          pointerEvents: 'none',
        }}
      />

      {corners.map(([vert, horiz]) => {
        const key = `${vert}${horiz}`;
        const rotation =
          key === 'tl' ? 0 : key === 'tr' ? 90 : key === 'br' ? 180 : 270;
        return (
          <svg
            key={key}
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            style={{
              position: 'absolute',
              top: vert === 't' ? 18 : undefined,
              bottom: vert === 'b' ? 18 : undefined,
              left: horiz === 'l' ? 18 : undefined,
              right: horiz === 'r' ? 18 : undefined,
              transform: `rotate(${rotation}deg)`,
              opacity: 0.7,
            }}
          >
            <path d="M1 1 L10 1 M1 1 L1 10" stroke={v.accent} strokeWidth="1" />
            <path d="M5 1 L5 5 L1 5" stroke={v.accent} strokeWidth=".7" opacity=".6" />
          </svg>
        );
      })}

      {/* From */}
      <div style={{ position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.2em',
            color: v.dim,
            textTransform: 'uppercase',
          }}
        >
          From
        </div>
        <div style={{ fontSize: 13, color: v.text, marginTop: 4, fontWeight: 500 }}>{from}</div>
      </div>

      {/* Center seal */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -58%)',
        }}
      >
        <div
          style={{
            width: width * 0.32,
            height: width * 0.32,
            borderRadius: '50%',
            background:
              status === 'empty'
                ? 'transparent'
                : variant === 'foil'
                ? 'radial-gradient(circle at 30% 30%, #c73b3b, #7e1418)'
                : 'radial-gradient(circle at 30% 30%, #e8d199, #b8923d 70%, #8a6b24)',
            border: `1px solid ${v.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: variant === 'foil' ? '#fbf8f2' : '#3b080a',
            fontFamily: 'var(--font-serif)',
            fontSize: width * 0.14,
            fontWeight: 400,
            boxShadow:
              status === 'empty'
                ? 'none'
                : '0 6px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.2)',
            position: 'relative',
          }}
        >
          {status === 'empty' ? (
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '.2em',
                color: v.dim,
                textTransform: 'uppercase',
              }}
            >
              empty
            </div>
          ) : (
            sealLabel
          )}
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: `1px dashed ${v.accent}`,
              opacity: 0.35,
            }}
          />
        </div>
      </div>

      {/* Amount */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: width * 0.22,
            lineHeight: 1,
            color: v.text,
            letterSpacing: '-0.03em',
          }}
          className={variant === 'ink' ? 'foil-text pckt-shimmer' : undefined}
        >
          {amount}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.25em',
            color: v.dim,
            marginTop: 6,
            textTransform: 'uppercase',
          }}
        >
          {unit}
        </div>
      </div>

      {/* Message */}
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 22,
          textAlign: 'center',
          fontSize: 11,
          color: v.dim,
          fontStyle: 'italic',
          lineHeight: 1.3,
        }}
      >
        {message ? `“${message}”` : ''}
      </div>

      {/* Wordmark */}
      <div style={{ position: 'absolute', bottom: 10, left: 16, opacity: 0.6 }}>
        <Wordmark size={11} color={v.dim} dotColor={v.accent} />
      </div>

      {hasRip && (
        <svg
          width={width}
          height="14"
          viewBox={`0 0 ${width} 14`}
          style={{ position: 'absolute', top: height * 0.34, left: 0 }}
        >
          <path
            d={`M0 7 ${Array.from(
              { length: Math.floor(width / 8) },
              (_, i) => `L${i * 8 + 4} ${7 + (i % 2 ? 3 : -3)} L${i * 8 + 8} 7`,
            ).join(' ')}`}
            stroke={v.accent}
            strokeWidth="0.6"
            fill="none"
            opacity=".6"
          />
        </svg>
      )}

      {status === 'opening' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            background:
              'radial-gradient(circle at 50% 35%, rgba(255,230,180,.25), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
