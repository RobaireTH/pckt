import { CSSProperties } from 'react';
import { Icon, IconName } from './Icon';

type Props = { name: IconName; onClick?: () => void; size?: number; style?: CSSProperties };

export function IconBtn({ name, onClick, size = 36, style }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-elev-2)',
        color: 'var(--fg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ...style,
      }}
    >
      <Icon name={name} size={16} />
    </button>
  );
}
