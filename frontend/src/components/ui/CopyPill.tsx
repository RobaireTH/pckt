import { useEffect } from 'react';
import { Icon } from './Icon';

type Props = {
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export function CopyPill({ message, onClose, durationMs = 1500 }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(id);
  }, [onClose, durationMs]);

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 32,
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: 'var(--fg)',
        color: 'var(--bg)',
        borderRadius: 999,
        padding: '9px 16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        animation: 'pckt-pill-in 180ms var(--ease-out)',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes pckt-pill-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <Icon name="check" size={14} stroke={2.25} />
      <span>{message}</span>
    </div>
  );
}
