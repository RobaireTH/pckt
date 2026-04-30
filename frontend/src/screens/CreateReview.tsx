import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { IconBtn } from '../components/ui/IconBtn';
import { Packet } from '../components/Packet';
import { useWallet } from '../hooks/useWallet';
import { packetTypeInfo } from '../packets';
import { buildAndRelaySealTx } from '../tx';
import type { Draft } from './CreateAmount';

type Props = {
  draft: Draft;
  onBack: () => void;
  onSeal: (result: { txHash: string; claimLink: string; publicShortLink: string }) => void;
  onClose: () => void;
};

export function CreateReview({ draft, onBack, onSeal, onClose }: Props) {
  const { wallet, signer, lockHash, openConnect } = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { type, amount, slots, message, unlock } = draft;
  const numAmount = Number(amount) || 0;
  const avg = slots > 0 ? Math.max(1, Math.round(numAmount / slots)) : 0;
  const typeLabel = packetTypeInfo(type === 'fixed' ? 0 : type === 'lucky' ? 1 : 2).label;

  const rows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: 'Type', value: typeLabel },
    { label: 'Total', value: `${amount} CKB`, mono: true },
    { label: 'Recipients', value: String(slots) },
    {
      label: type === 'lucky' ? 'Per slot' : 'Each',
      value: type === 'lucky' ? `avg. ${avg} CKB` : `${avg} CKB`,
    },
  ];

  if (type === 'timed') {
    rows.push({
      label: 'Unlocks',
      value: new Date(unlock).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  } else {
    rows.push({ label: 'Expires', value: '7 days after send' });
  }

  rows.push(
    { label: 'Network fee', value: 'Calculated by the wallet at signing' },
    { label: 'From', value: wallet ? wallet.shortAddress : 'Not connected', mono: !!wallet },
  );

  const sealLabel = submitting ? 'Sealing…' : wallet ? 'Seal & sign' : 'Connect to seal';
  const sealIcon = wallet ? 'seal' : 'wallet';
  const signedFromNote = wallet
    ? `Signs with ${wallet.walletName} · ${wallet.shortAddress}`
    : 'A wallet is required to sign and lock funds';

  const sealNow = async () => {
    if (!wallet || !signer || !lockHash) {
      openConnect();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await buildAndRelaySealTx({ draft, signer, ownerLockHash: lockHash });
      onSeal(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <header
        className="pckt-create-mobile-header"
        style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <IconBtn name="arrow_left" onClick={onBack} />
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>Review</div>
        <IconBtn name="close" onClick={onClose} />
      </header>
      <style>{`
        @media (min-width: 900px) { .pckt-create-mobile-header { display: none; } }
      `}</style>

      <div className="pckt-create-layout">
        <div>
          <div style={{ padding: '24px 20px 0' }}>
            <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', marginBottom: 6 }}>
              Step 3 of 3 · Review
            </div>
            <h1
              className="pckt-section-title"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 28,
                margin: 0,
                letterSpacing: '-0.02em',
                color: 'var(--fg)',
              }}
            >
              Seal your packet
            </h1>
            <p
              style={{
                fontSize: 14,
                color: 'var(--fg-muted)',
                margin: '8px 0 0',
                lineHeight: 1.5,
              }}
            >
              Check everything, then sign with your wallet. The packet becomes a shareable link
              once sealed.
            </p>
          </div>

          <section style={{ padding: '24px 20px 0' }}>
            <div
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{r.label}</div>
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--fg)',
                      fontWeight: 500,
                      fontFamily: r.mono ? 'var(--font-mono)' : 'var(--font-sans)',
                    }}
                  >
                    {r.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 8 }}>Message</div>
            <div
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 16px',
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                fontStyle: 'italic',
                color: 'var(--fg)',
                lineHeight: 1.4,
                minHeight: 52,
              }}
            >
              {message || <span style={{ color: 'var(--fg-quiet)' }}>No message</span>}
            </div>
          </section>

          <section style={{ padding: '20px 20px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                background: 'var(--accent-weak)',
                border: '1px solid rgba(126,20,24,.2)',
                borderRadius: 12,
              }}
            >
              <div style={{ color: 'var(--crimson-600)', paddingTop: 1 }}>
                <Icon name="lock" size={16} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>
                Funds are locked on-chain until recipients claim, or they're returned to you after
                expiry. Unclaimed slots don't disappear.
              </div>
            </div>
          </section>

          <div className="pckt-create-mobile-cta" style={{ padding: '20px 20px 32px' }}>
            <Button variant="primary" size="lg" full icon={sealIcon} onClick={sealNow} disabled={submitting}>
              {sealLabel}
            </Button>
            {error && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--crimson-600)' }}>{error}</div>}
            <div
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--fg-quiet)',
                fontFamily: 'var(--font-mono)',
                marginTop: 10,
                letterSpacing: '.04em',
              }}
            >
              {signedFromNote}
            </div>
          </div>
          <style>{`
            @media (min-width: 900px) { .pckt-create-mobile-cta { display: none; } }
          `}</style>
        </div>

        <aside className="pckt-create-preview">
          <div
            className="t-eyebrow"
            style={{ color: 'var(--crimson-600)', alignSelf: 'flex-start' }}
          >
            Final look
          </div>
          <Packet
            width={260}
            height={368}
            amount={amount || '0'}
            from={wallet?.shortAddress ?? 'your wallet'}
            message={message}
            variant="crimson"
          />
          <div
            style={{
              fontSize: 12,
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
              letterSpacing: '.04em',
            }}
          >
            {typeLabel} · {slots} slots · {amount} CKB
          </div>
          <Button variant="primary" size="lg" full icon={sealIcon} onClick={sealNow} disabled={submitting}>
            {sealLabel}
          </Button>
          <div
            style={{
              fontSize: 11,
              color: 'var(--fg-quiet)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '.04em',
              textAlign: 'center',
            }}
          >
            {signedFromNote}
          </div>
        </aside>
      </div>
    </div>
  );
}
