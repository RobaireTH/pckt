import { Icon, IconName } from './Icon';

export type AlertTone = 'error' | 'warning' | 'success' | 'info';

type Props = {
  tone?: AlertTone;
  title?: string;
  message: string;
  hint?: string;
  icon?: IconName;
  onDismiss?: () => void;
  style?: React.CSSProperties;
};

const TONE: Record<
  AlertTone,
  { bg: string; border: string; fg: string; icon: IconName }
> = {
  error: {
    bg: 'rgba(126,20,24,.08)',
    border: 'rgba(126,20,24,.22)',
    fg: 'var(--danger)',
    icon: 'bell',
  },
  warning: {
    bg: 'rgba(212,180,106,.14)',
    border: 'rgba(212,180,106,.36)',
    fg: '#8a6b24',
    icon: 'clock',
  },
  success: {
    bg: 'rgba(74,138,92,.12)',
    border: 'rgba(74,138,92,.28)',
    fg: 'var(--ok)',
    icon: 'check',
  },
  info: {
    bg: 'var(--bg-elev)',
    border: 'var(--border)',
    fg: 'var(--fg)',
    icon: 'sparkle',
  },
};

export function Alert({ tone = 'error', title, message, hint, icon, onDismiss, style }: Props) {
  const t = TONE[tone];
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        color: 'var(--fg)',
        fontSize: 13,
        lineHeight: 1.5,
        ...style,
      }}
    >
      <div style={{ color: t.fg, paddingTop: 1, flexShrink: 0 }}>
        <Icon name={(icon ?? t.icon) as IconName} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontWeight: 600, color: t.fg, marginBottom: 2 }}>{title}</div>
        )}
        <div style={{ color: 'var(--fg)' }}>{message}</div>
        {hint && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--fg-muted)' }}>{hint}</div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
            padding: 2,
            lineHeight: 0,
          }}
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
