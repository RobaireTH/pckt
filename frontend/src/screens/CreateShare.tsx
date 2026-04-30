import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Packet } from '../components/Packet';
import { useWallet } from '../hooks/useWallet';
import { explorerTxUrl } from '../packets';
import type { Draft } from './CreateAmount';

type Props = {
  draft: Draft;
  onAnother: () => void;
  onHome: () => void;
  claimLink: string;
  publicShortLink: string;
  txHash: string;
};

export function CreateShare({ draft, onAnother, onHome, claimLink, publicShortLink, txHash }: Props) {
  const { amount, message, slots } = draft;
  const { wallet } = useWallet();
  const [fullLink] = useState(claimLink);
  const [displayLink] = useState(claimLink.replace(/^https?:\/\//, ''));
  const [copied, setCopied] = useState(false);
  const sealExplorerUrl = explorerTxUrl(txHash);

  const copy = () => {
    navigator.clipboard?.writeText(fullLink).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {},
    );
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'A pckt for you', text: message, url: fullLink });
      } catch {}
    } else {
      copy();
    }
  };

  return (
    <div className="pckt-share-wrap">
      <div
        className="t-eyebrow"
        style={{ color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Icon name="check" size={14} stroke={2} />
        Sealed
      </div>
      <h1
        className="pckt-section-title"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 32,
          letterSpacing: '-0.02em',
          color: 'var(--fg)',
          margin: '8px 0 6px',
        }}
      >
        Your packet is ready
      </h1>
      <p
        style={{
          fontSize: 14,
          color: 'var(--fg-muted)',
          lineHeight: 1.55,
          maxWidth: 440,
          margin: 0,
        }}
      >
        Share this link with anyone. The first {slots} claims get a slice of {amount} CKB.
      </p>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-muted)', maxWidth: 440 }}>
        This secure link includes the claim secret in the URL fragment (client-side only). The backend
        only receives the public short link.
      </div>
      <div
        style={{
          marginTop: 8,
          maxWidth: 440,
          padding: '12px 14px',
          background: 'rgba(126,20,24,.08)',
          border: '1px solid rgba(126,20,24,.16)',
          borderRadius: 12,
          fontSize: 12,
          color: 'var(--fg)',
          lineHeight: 1.55,
        }}
      >
        For now, this secure share link is only shown once on this screen. Copy or share it before
        leaving, because you will not be able to reopen it later.
      </div>

      <div className="pckt-share-packet">
        <Packet
          width={240}
          height={340}
          amount={amount || '0'}
          from={wallet?.shortAddress ?? 'your wallet'}
          message={message}
          variant="foil"
        />
      </div>

      <div className="pckt-share-card">
        <div className="pckt-share-link">
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
            Claim link
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              color: 'var(--fg)',
              wordBreak: 'break-all',
            }}
          >
            {displayLink}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
          <Button
            variant={copied ? 'secondary' : 'primary'}
            size="lg"
            icon={copied ? 'check' : 'copy'}
            onClick={copy}
            full
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button variant="ghost" size="lg" icon="share" onClick={share} full>
            Share
          </Button>
        </div>
        <div style={{ width: '100%', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quiet)' }}>
          Seal tx: {txHash.slice(0, 14)}…{txHash.slice(-8)}
        </div>
        <a
          href={sealExplorerUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            width: '100%',
            marginTop: 6,
            fontSize: 12,
            color: 'var(--crimson-600)',
            textDecoration: 'none',
          }}
        >
          View seal tx on explorer →
        </a>
        {publicShortLink && (
          <div style={{ width: '100%', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-quiet)' }}>
            Public short link: {publicShortLink.replace(/^https?:\/\//, '')}
          </div>
        )}
      </div>

      <div
        className="pckt-share-qr"
        style={{
          maxWidth: 320,
          textAlign: 'center',
          color: 'var(--fg-muted)',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        QR sharing is disabled in this build until a real scannable code is wired. Use the secure
        link above for testnet claims.
      </div>

      <div className="pckt-share-footer">
        <Button variant="ghost" size="lg" icon="plus" onClick={onAnother}>
          Send another
        </Button>
        <Button variant="primary" size="lg" iconRight="arrow_right" onClick={onHome}>
          Back to home
        </Button>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--fg-quiet)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '.04em',
          textAlign: 'center',
          maxWidth: 420,
        }}
      >
        Leaving this screen hides the secure claim link for now.
      </div>
    </div>
  );
}
