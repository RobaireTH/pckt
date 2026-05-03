import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Icon, IconName } from '../components/ui/Icon';
import { useWallet } from '../hooks/useWallet';
import type { ClaimedPacket, PacketSummary, SenderProfile } from '../api';
import {
  LocalePreference,
  readLocalePreference,
  writeLocalePreference,
} from '../locale';
import { toCkb } from '../packets';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';
}

export function Profile({
  sentPackets,
  claimedPackets,
  priceUsd,
  senderProfile,
  onEditProfile,
}: {
  sentPackets: PacketSummary[];
  claimedPackets: ClaimedPacket[];
  priceUsd: number | null;
  senderProfile: SenderProfile | null;
  onEditProfile: () => void;
}) {
  const { wallet, openConnect, disconnect, balance } = useWallet();
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [locale, setLocale] = useState<LocalePreference>(readLocalePreference);
  const [notificationState, setNotificationState] = useState<string>(
    typeof Notification === 'undefined' ? 'Unsupported' : Notification.permission,
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('theme-dark', theme === 'dark');
    html.classList.toggle('theme-light', theme === 'light');
    try {
      localStorage.setItem('pckt:theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    if (!confirmingDisconnect) return;
    confirmTimer.current = window.setTimeout(
      () => setConfirmingDisconnect(false),
      2800,
    );
    return () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    };
  }, [confirmingDisconnect]);

  useEffect(() => {
    const sync = () => {
      setLocale(readLocalePreference());
      setNotificationState(
        typeof Notification === 'undefined' ? 'Unsupported' : Notification.permission,
      );
    };
    window.addEventListener('focus', sync);
    window.addEventListener('pckt:locale-change', sync as EventListener);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('pckt:locale-change', sync as EventListener);
    };
  }, []);

  const onDisconnectClick = () => {
    if (confirmingDisconnect) {
      disconnect();
      setConfirmingDisconnect(false);
    } else {
      setConfirmingDisconnect(true);
    }
  };

  const copyAddress = () => {
    if (!wallet?.address) return;
    navigator.clipboard?.writeText(wallet.address).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {},
    );
  };
  const cycleLanguage = () => {
    const next: LocalePreference =
      locale === 'system' ? 'en-US' : locale === 'en-US' ? 'en-GB' : 'system';
    writeLocalePreference(next);
    setLocale(next);
    setActionNotice(
      next === 'system'
        ? 'Language set to your browser default.'
        : `Language formatting set to ${next}.`,
    );
  };
  const inviteFriend = async () => {
    const url = `${window.location.origin}/#/landing`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'pckt', text: 'A friendly way to send ckb.', url });
        setActionNotice('Invite link shared.');
        return;
      } catch {}
    }
    navigator.clipboard?.writeText(url).then(
      () => setActionNotice('Invite link copied.'),
      () => setActionNotice('Could not copy invite link.'),
    );
  };
  const handleNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setActionNotice('Notifications are not supported in this browser.');
      return;
    }
    if (Notification.permission === 'granted') {
      setActionNotice('Notifications are already enabled.');
      return;
    }
    if (Notification.permission === 'denied') {
      setActionNotice('Notifications are blocked in browser settings.');
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationState(result);
    setActionNotice(
      result === 'granted'
        ? 'Notifications enabled.'
        : 'Notifications were not enabled.',
    );
  };
  const openHelp = () => {
    const subject = encodeURIComponent('pckt feedback');
    const safePage = window.location.href.split('#')[0];
    const body = encodeURIComponent(`Share what happened:\n\nPage: ${safePage}\n\n`);
    window.open(`mailto:robaireth@gmail.com?subject=${subject}&body=${body}`, '_blank');
    setActionNotice('Opening your email app for feedback.');
  };
  const balanceCkb = balance ? toCkb(balance) : 0;
  const movedCkb = sentPackets.reduce(
    (sum, p) => sum + Math.floor(Number(p.initial_capacity) / 100000000),
    0,
  );

  return (
    <div className="pckt-page">
      <header className="pckt-page-header">
        <h1
          className="pckt-section-title"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 32,
            letterSpacing: '-0.02em',
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          Profile
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: '6px 0 0' }}>
          {wallet ? 'Your wallet, packets, and preferences.' : 'Connect a wallet to begin.'}
        </p>
      </header>

      {wallet ? (
        <>
          <section className="pckt-profile-hero">
            <div style={{ position: 'relative' }}>
              <Avatar name={wallet.initials} size={72} />
              {wallet.walletIcon && (
                <img
                  src={wallet.walletIcon}
                  alt={wallet.walletName}
                  width={26}
                  height={26}
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    borderRadius: '50%',
                    background: 'var(--bg-elev)',
                    border: '2px solid var(--bg)',
                    padding: 2,
                  }}
                />
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 26,
                  letterSpacing: '-0.02em',
                  color: 'var(--fg)',
                }}
              >
                {senderProfile?.username || wallet.shortAddress}
              </div>
              {senderProfile?.username && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--fg-muted)',
                    fontFamily: 'var(--font-mono)',
                    marginTop: 4,
                  }}
                >
                  {wallet.shortAddress}
                </div>
              )}
              <button
                onClick={copyAddress}
                style={{
                  marginTop: 6,
                  background: 'transparent',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  color: 'var(--fg-muted)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '.04em',
                }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={12} />
                {copied ? 'Copied' : 'Copy address'}
              </button>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--fg-quiet)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 4,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
                via {wallet.walletName}
              </div>
            </div>
          </section>

          <section style={{ padding: '4px 20px 0' }}>
            <div
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '18px 20px',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--fg-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '.15em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Balance
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 40,
                    letterSpacing: '-0.02em',
                    color: 'var(--fg)',
                    lineHeight: 1,
                  }}
                >
                  {balanceCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: 'var(--fg-muted)',
                  }}
                >
                  CKB
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--fg-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 4,
                }}
              >
                {priceUsd ? `≈ $${(balanceCkb * priceUsd).toFixed(2)} USD` : 'Price unavailable'}
              </div>
            </div>
          </section>

          <section style={{ padding: '16px 20px 0' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                background: 'var(--border)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <Stat label="Sent" value={String(sentPackets.length)} sub="packets" />
              <Stat label="Claimed" value={String(claimedPackets.length)} sub="packets" />
              <Stat label="Moved" value={`${movedCkb.toLocaleString()}`} sub="CKB" />
            </div>
          </section>
        </>
      ) : (
        <section className="pckt-profile-empty">
          <div className="pckt-profile-empty-icon">
            <Icon name="wallet" size={28} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 26,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
              marginTop: 18,
            }}
          >
            No wallet connected
          </div>
          <p
            style={{
              fontSize: 14,
              color: 'var(--fg-muted)',
              lineHeight: 1.55,
              maxWidth: 360,
              margin: '8px 0 20px',
            }}
          >
            Connect a CKB wallet to send and claim packets. pckt never holds your keys.
          </p>
          <Button variant="primary" size="lg" icon="wallet" onClick={openConnect}>
            Connect wallet
          </Button>
        </section>
      )}

      <section style={{ padding: '24px 20px 0' }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '.15em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Settings
        </div>
        <div
          style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <ThemeRow theme={theme} onChange={setTheme} />
          <Row
            icon="user"
            title="Sender name"
            value={senderProfile?.username || 'Not set'}
            cta={senderProfile ? 'Edit' : 'Set'}
            onClick={onEditProfile}
          />
          <Row
            icon="bell"
            title="Notifications"
            value={notificationState === 'default' ? 'Off' : notificationState === 'granted' ? 'On' : notificationState}
            cta="Manage"
            onClick={handleNotifications}
          />
          <Row
            icon="settings"
            title="Language"
            value={locale === 'system' ? 'System' : locale}
            cta="Switch"
            onClick={cycleLanguage}
          />
          <Row icon="share" title="Invite a friend" cta="Share" onClick={inviteFriend} />
          <Row icon="search" title="Help & feedback" cta="Email" onClick={openHelp} />
        </div>
      </section>
      {actionNotice && (
        <section style={{ padding: '14px 20px 0' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(74,138,92,.10)',
              border: '1px solid rgba(74,138,92,.18)',
              fontSize: 12,
              color: 'var(--fg)',
              lineHeight: 1.5,
            }}
          >
            {actionNotice}
          </div>
        </section>
      )}

      {wallet && (
        <section style={{ padding: '24px 20px 40px' }}>
          <button
            onClick={onDisconnectClick}
            className="pckt-disconnect"
            data-confirming={confirmingDisconnect ? 'true' : 'false'}
          >
            {confirmingDisconnect ? 'Tap again to confirm disconnect' : 'Disconnect wallet'}
          </button>
          <div
            style={{
              marginTop: 14,
              textAlign: 'center',
              fontSize: 10,
              color: 'var(--fg-quiet)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '.1em',
            }}
          >
            pckt · v0.1 · built on CKB
          </div>
        </section>
      )}

      {!wallet && (
        <div
          style={{
            padding: '24px 20px 40px',
            textAlign: 'center',
            fontSize: 10,
            color: 'var(--fg-quiet)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '.1em',
          }}
        >
          pckt · v0.1 · built on CKB
        </div>
      )}
    </div>
  );
}

function ThemeRow({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        color: 'var(--fg)',
      }}
    >
      <div style={{ color: 'var(--fg-muted)', display: 'flex' }}>
        <Icon name={theme === 'light' ? 'sun' : 'moon'} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>Theme</div>
      </div>
      <div className="pckt-theme-seg" role="group" aria-label="Theme">
        <button
          type="button"
          data-active={theme === 'light' ? 'true' : 'false'}
          onClick={() => onChange('light')}
        >
          <Icon name="sun" size={13} stroke={1.8} />
          Light
        </button>
        <button
          type="button"
          data-active={theme === 'dark' ? 'true' : 'false'}
          onClick={() => onChange('dark')}
        >
          <Icon name="moon" size={13} stroke={1.8} />
          Dark
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: 'var(--bg-elev)', padding: '14px 12px', textAlign: 'center' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          color: 'var(--fg)',
          letterSpacing: '-0.01em',
          marginTop: 2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--fg-quiet)',
          fontFamily: 'var(--font-mono)',
          marginTop: 2,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  value,
  onClick,
  cta,
}: {
  icon: IconName;
  title: string;
  value?: string;
  onClick?: () => void;
  cta?: string;
}) {
  const clickable = !!onClick || !!cta;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: 'transparent',
        border: 'none',
        borderTop: '1px solid var(--border)',
        textAlign: 'left',
        cursor: clickable ? 'pointer' : 'default',
        color: 'var(--fg)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ color: 'var(--fg-muted)', display: 'flex' }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{title}</div>
      </div>
      {value && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {value}
        </div>
      )}
      {cta && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--crimson-600)',
            fontWeight: 500,
            marginLeft: 6,
          }}
        >
          {cta} →
        </div>
      )}
    </button>
  );
}
