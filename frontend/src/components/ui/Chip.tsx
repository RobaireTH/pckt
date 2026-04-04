import { ReactNode } from 'react';
import { Icon, IconName } from './Icon';

type Props = {
  active?: boolean;
  children: ReactNode;
  icon?: IconName;
  onClick?: () => void;
};

export function Chip({ active, children, icon, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        background: active ? 'var(--fg)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--fg-dim)',
        border: `1px solid ${active ? 'var(--fg)' : 'var(--border)'}`,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  );
}
