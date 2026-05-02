import { useEffect } from 'react';
import { Icon, IconName } from './ui/Icon';
import { IconBtn } from './ui/IconBtn';
import { Button } from './ui/Button';
import type { NotifEntry, NotifKind } from '../hooks/useNotifications';

type Props = {
  open: boolean;
  feed: NotifEntry[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  notifPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  onEnableNotifications?: () => void;
};

const KIND_META: Record<NotifKind, { icon: IconName; tint: string; bg: string }> = {
  claim_out: { icon: 'sparkle', tint: 'var(--crimson-600)', bg: 'rgba(126,20,24,.10)' },
  fully_claimed: { icon: 'check', tint: 'var(--ok)', bg: 'rgba(74,138,92,.14)' },
  claim_in: { icon: 'coins', tint: 'var(--ok)', bg: 'rgba(74,138,92,.14)' },
  reclaim_ready: { icon: 'clock', tint: '#8a6b24', bg: 'rgba(212,180,106,.18)' },
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function NotificationsPanel({
  open,
  feed,
  onClose,
  onMarkAllRead,
  onClear,
  notifPermission,
  onEnableNotifications,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Mark everything as read once the panel is opened — matches the iOS/Android pattern.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(onMarkAllRead, 600);
      return () => window.clearTimeout(t);
    }
  }, [open, onMarkAllRead]);

  if (!open) return null;
  const hasItems = feed.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,9,7,.45)',
        zIndex: 150,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'pckt-notif-fade 160ms ease-out',
      }}
    >
      <style>{`
        @keyframes pckt-notif-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pckt-notif-slide { from { transform: translateX(16px); opacity: 0; } to { transform: none; opacity: 1; } }
      `}</style>
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          height: '100%',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'pckt-notif-slide 220ms var(--ease-out)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                letterSpacing: '-0.02em',
                color: 'var(--fg)',
              }}
            >
              Notifications
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
              {hasItems
                ? 'New activity from your packets and claims.'
                : 'Nothing yet — claims and reclaims will land here.'}
            </div>
          </div>
          <IconBtn name="close" onClick={onClose} />
        </header>

        {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
          <div
            style={{
              margin: '12px 16px 0',
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(212,180,106,.14)',
              border: '1px solid rgba(212,180,106,.36)',
              fontSize: 12,
              color: 'var(--fg)',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Icon name="bell" size={16} color="#8a6b24" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#8a6b24', marginBottom: 2 }}>
                Stay in the loop
              </div>
              <div style={{ color: 'var(--fg-muted)' }}>
                Turn on browser notifications to hear about claims even when this tab is in the background.
              </div>
              {notifPermission === 'default' && onEnableNotifications && (
                <div style={{ marginTop: 8 }}>
                  <Button variant="secondary" size="sm" onClick={onEnableNotifications}>
                    Enable
                  </Button>
                </div>
              )}
              {notifPermission === 'denied' && (
                <div style={{ marginTop: 6, color: 'var(--fg-muted)' }}>
                  Blocked in browser settings — re-enable from your site permissions.
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!hasItems ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 24px',
                color: 'var(--fg-muted)',
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              <div style={{ marginBottom: 10, color: 'var(--fg-quiet)' }}>
                <Icon name="bell" size={28} />
              </div>
              You're all caught up. New activity on packets you sent or claimed will show up here.
            </div>
          ) : (
            feed.map(entry => {
              const meta = KIND_META[entry.kind];
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    gap: 12,
                    borderBottom: '1px solid var(--border)',
                    background: entry.read ? 'transparent' : 'var(--bg-elev)',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: meta.bg,
                      color: meta.tint,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={meta.icon} size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--fg)',
                          lineHeight: 1.35,
                        }}
                      >
                        {entry.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--fg-quiet)',
                          fontFamily: 'var(--font-mono)',
                          flexShrink: 0,
                        }}
                      >
                        {relativeTime(entry.ts)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--fg-muted)',
                        lineHeight: 1.5,
                        marginTop: 3,
                      }}
                    >
                      {entry.body}
                    </div>
                  </div>
                  {!entry.read && (
                    <div
                      aria-label="Unread"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--crimson-600)',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {hasItems && (
          <footer
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear all
            </Button>
          </footer>
        )}
      </aside>
    </div>
  );
}
