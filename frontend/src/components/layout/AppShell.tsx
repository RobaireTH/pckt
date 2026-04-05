import { ReactNode } from 'react';
import { Icon, IconName } from '../ui/Icon';
import { LockupHorizontal } from '../brand/LockupHorizontal';
import { Avatar } from '../ui/Avatar';
import { useWallet } from '../../hooks/useWallet';
import type { Route } from '../../App';

type Tab = 'home' | 'inbox' | 'create' | 'history' | 'me';

type Props = {
  children: ReactNode;
  active: Tab;
  go: (r: Route) => void;
};

type TabDef = {
  id: Tab;
  icon: IconName;
  label: string;
  route: Route;
  big?: boolean;
};

const tabs: TabDef[] = [
  { id: 'home', icon: 'home', label: 'Home', route: 'app' },
  { id: 'inbox', icon: 'inbox', label: 'Inbox', route: 'inbox' },
  { id: 'create', icon: 'plus', label: 'Send', route: 'create', big: true },
  { id: 'history', icon: 'clock', label: 'Activity', route: 'activity' },
  { id: 'me', icon: 'user', label: 'Me', route: 'me' },
];

const topnavLinks: Array<{ id: Tab; label: string; route: Route; icon?: IconName }> = [
  { id: 'home', label: 'Home', route: 'app', icon: 'home' },
  { id: 'inbox', label: 'Inbox', route: 'inbox', icon: 'inbox' },
  { id: 'history', label: 'Activity', route: 'activity', icon: 'clock' },
];

export function AppShell({ children, active, go }: Props) {
  const { wallet, openConnect } = useWallet();

  return (
    <div className="pckt-shell">
      <header className="pckt-topnav">
        <div className="pckt-topnav-inner">
          <button
            onClick={() => go('landing')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
            }}
            aria-label="pckt home"
          >
            <LockupHorizontal size={22} />
          </button>

          <div className="pckt-topnav-links">
            {topnavLinks.map(link => (
              <button
                key={link.id}
                className="pckt-topnav-link"
                data-active={active === link.id ? 'true' : 'false'}
                onClick={() => go(link.route)}
              >
                {link.icon && <Icon name={link.icon} size={16} />}
                {link.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {wallet ? (
              <>
                <button
                  onClick={() => go('create')}
                  className="pckt-pill-primary"
                >
                  <Icon name="plus" size={14} stroke={2} />
                  Send packet
                </button>
                <button
                  onClick={() => go('me')}
                  aria-label="Profile"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    borderRadius: '50%',
                    outline: active === 'me' ? '2px solid var(--accent)' : 'none',
                    outlineOffset: 2,
                  }}
                >
                  <Avatar name={wallet.initials} size={36} />
                </button>
              </>
            ) : (
              <button onClick={openConnect} className="pckt-pill-primary">
                <Icon name="wallet" size={14} stroke={2} />
                Connect wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="pckt-shell-main">{children}</main>

      <nav className="pckt-bottomnav">
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          {tabs.map(tab => {
            const isActive = active === tab.id;
            if (tab.big) {
              return (
                <button
                  key={tab.id}
                  onClick={() => go(tab.route)}
                  aria-label={tab.label}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--accent)',
                    color: 'var(--ink-10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow:
                      '0 10px 24px rgba(126,20,24,.35), 0 2px 6px rgba(126,20,24,.2)',
                    transform: 'translateY(-10px)',
                  }}
                >
                  <Icon name="plus" size={24} stroke={2} />
                </button>
              );
            }
            return (
              <button
                key={tab.id}
                onClick={() => go(tab.route)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '4px 8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isActive ? 'var(--fg)' : 'var(--fg-quiet)',
                  minWidth: 56,
                }}
              >
                <Icon name={tab.icon} size={20} stroke={isActive ? 2 : 1.5} />
                <span
                  style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.02em' }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
