import { CSSProperties } from 'react';

type Props = {
  size?: number;
  color?: string;
  dotColor?: string;
  style?: CSSProperties;
};

export function Wordmark({
  size = 28,
  color = 'currentColor',
  dotColor = 'var(--foil, #E8B04A)',
  style,
}: Props) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontWeight: 400,
        fontSize: size,
        letterSpacing: '-0.04em',
        color,
        lineHeight: 1,
        ...style,
      }}
    >
      <span>pckt</span>
      <span
        style={{
          display: 'inline-block',
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: '50%',
          background: dotColor,
          marginLeft: size * 0.06,
          transform: `translateY(${size * -0.02}px)`,
          boxShadow: `inset 0 ${size * 0.015}px ${size * 0.03}px rgba(255,255,255,.5)`,
        }}
      />
    </span>
  );
}
