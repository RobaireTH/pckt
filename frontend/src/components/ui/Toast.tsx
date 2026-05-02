import { useEffect } from 'react';
import { Alert, AlertTone } from './Alert';

type Props = {
  tone?: AlertTone;
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export function Toast({ tone = 'success', message, onClose, durationMs = 2600 }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(id);
  }, [onClose, durationMs]);

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 28,
        transform: 'translateX(-50%)',
        zIndex: 200,
        maxWidth: 'min(92vw, 420px)',
        animation: 'pckt-toast-in 220ms var(--ease-out)',
      }}
    >
      <style>{`
        @keyframes pckt-toast-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <Alert tone={tone} message={message} onDismiss={onClose} />
    </div>
  );
}
