import { CSSProperties } from 'react';

type Props = { size?: number; rounded?: number; style?: CSSProperties };

// "The fold" — abstract three-facet origami mark.
// Left facet in gold foil, right facet in crimson, inner crease shadow.
// When `rounded` > 0, renders inside a dark rounded square (favicon form).
export function PacketMark({ size = 40, rounded = 0, style }: Props) {
  const uid = `pm-${size}-${rounded}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-label="pckt"
      style={style}
    >
      <defs>
        <linearGradient id={`${uid}-l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8B04A" />
          <stop offset="1" stopColor="#B88630" />
        </linearGradient>
        <linearGradient id={`${uid}-m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C41F26" />
          <stop offset="1" stopColor="#8B1419" />
        </linearGradient>
        <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6a0e12" />
          <stop offset="1" stopColor="#3d0709" />
        </linearGradient>
      </defs>
      {rounded > 0 && <rect width="200" height="200" rx={rounded} fill="#0b0907" />}
      <g transform={rounded > 0 ? 'translate(25 25) scale(0.75)' : undefined}>
        <path d="M 40 100 L 100 40 L 100 160 Z" fill={`url(#${uid}-l)`} />
        <path d="M 100 40 L 160 100 L 100 160 Z" fill={`url(#${uid}-m)`} />
        <path
          d="M 100 40 L 100 160 L 130 100 Z"
          fill={`url(#${uid}-s)`}
          opacity=".55"
        />
        <path
          d="M 100 40 L 100 160"
          stroke="#FBF5E6"
          strokeWidth="1.5"
          opacity=".55"
        />
      </g>
    </svg>
  );
}
