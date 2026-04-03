import { PacketMark } from './PacketMark';
import { Wordmark } from './Wordmark';

type Props = {
  size?: number;
  color?: string;
  showTag?: boolean;
};

export function LockupHorizontal({ size = 28, color = 'currentColor', showTag = false }: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.45, color }}>
      <PacketMark size={size * 1.35} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
        <Wordmark size={size} color={color} />
        {showTag && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: size * 0.32,
              letterSpacing: '.18em',
              color: 'var(--fg-muted)',
              textTransform: 'uppercase',
            }}
          >
            Red packets · on CKB
          </span>
        )}
      </span>
    </span>
  );
}
