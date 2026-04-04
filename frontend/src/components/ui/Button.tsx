import { ButtonHTMLAttributes, CSSProperties } from 'react';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'foil' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
};

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--accent)', color: 'var(--ink-10)', border: '1px solid var(--accent)' },
  secondary: {
    background: 'var(--bg-elev-2)',
    color: 'var(--fg)',
    border: '1px solid var(--border-strong)',
  },
  ghost: { background: 'transparent', color: 'var(--fg)', border: '1px solid var(--border)' },
  foil: {
    background: 'linear-gradient(100deg,#d4b46a,#f5e8c6 45%,#b8923d)',
    color: 'var(--ink-0)',
    border: '1px solid rgba(0,0,0,.15)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--err)',
    border: '1px solid rgba(179,58,58,.4)',
  },
};

const SIZES: Record<Size, CSSProperties> = {
  sm: { padding: '7px 12px', fontSize: 13, borderRadius: 'var(--r-3)', height: 32 },
  md: { padding: '10px 16px', fontSize: 14, borderRadius: 'var(--r-3)', height: 40 },
  lg: { padding: '14px 22px', fontSize: 15, borderRadius: 'var(--r-3)', height: 48 },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  full,
  style,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        letterSpacing: '-0.01em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'transform .1s var(--ease-out), background .15s',
        width: full ? '100%' : undefined,
        ...SIZES[size],
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}
