import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Toast } from '../components/ui/Toast';
import { CopyPill } from '../components/ui/CopyPill';
import { Packet } from '../components/Packet';
import {
  fetchPacket,
  pairDeviceToken,
  retrievePacketSecret,
  type PacketSummary,
} from '../api';
import { useWallet } from '../hooks/useWallet';
import { friendlyError, type FriendlyError } from '../errors';
import { getOrCreateDeviceToken, setDeviceToken } from '../deviceToken';
import type { AlertTone } from '../components/ui/Alert';

type Props = { outPoint: string | null; onBack: () => void };

export function Reshare({ outPoint, onBack }: Props) {
  const [packet, setPacket] = useState<PacketSummary | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ tone: AlertTone; message: string } | null>(null);
  const [pill, setPill] = useState<string | null>(null);
  const { lockHash } = useWallet();

  const load = () => {
    if (!outPoint) {
      setError({ title: 'No packet selected', message: 'Open a packet from your inbox to reshare.' });
      return;
    }
    setLoading(true);
    setError(null);
    setLink(null);
    const token = getOrCreateDeviceToken();
    Promise.all([fetchPacket(outPoint), retrievePacketSecret({ out_point: outPoint, device_token: token })])
      .then(([pkt, sec]) => {
        setPacket(pkt);
        const claimLink = `${window.location.origin}/#/claim/${encodeURIComponent(
          pkt.claim_pubkey_hash || '',
        )}/${encodeURIComponent(sec.claim_sk)}`;
        setLink(claimLink);
      })
      .catch(e => setError(friendlyError(e, 'share')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [outPoint]);

  const owns = packet && lockHash && packet.owner_lock_hash === lockHash;
  const showPairing =
    error?.title?.toLowerCase().includes('unauthorized') ||
    error?.message?.toLowerCase().includes('not paired');

  const submitPair = async () => {
    if (!packet) return;
    if (!pairCode.trim()) return;
    setPairing(true);
    setError(null);
    try {
      const newToken = getOrCreateDeviceToken();
      await pairDeviceToken({
        owner_lock_hash: packet.owner_lock_hash || '',
        device_token: newToken,
        existing_token: pairCode.trim(),
      });
      setToast({ tone: 'success', message: 'Device paired. Loading link…' });
      load();
    } catch (e) {
      setError(friendlyError(e, 'share'));
    } finally {
      setPairing(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      setPill('Link copied');
    } catch {
      setToast({ tone: 'error', message: 'Could not copy. Long-press to copy manually.' });
    }
  };

  const share = async () => {
    if (!link) return;
    const payload: ShareData = {
      title: 'A pckt for you',
      text: 'Open this pckt:',
      url: link,
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    copy(link);
  };

  const usePastedToken = () => {
    const trimmed = pairCode.trim();
    if (trimmed.length < 16) return;
    setDeviceToken(trimmed);
    setPairCode('');
    load();
  };

  const remaining = packet ? Math.max(0, packet.slots_total - packet.slots_claimed) : 0;
  const displayLink = link ? link.replace(/^https?:\/\//, '') : '';

  return (
    <div className="pckt-share-wrap">
      <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', marginBottom: 12 }}>
        Reshare packet
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 32,
          letterSpacing: '-0.02em',
          margin: '0 0 6px',
          color: 'var(--fg)',
        }}
      >
        Send the link again
      </h1>
      <p style={{ fontSize: 14, color: 'var(--fg-muted)', maxWidth: 440, margin: 0 }}>
        {packet
          ? `${remaining} of ${packet.slots_total} slots still open.`
          : 'Loading packet…'}
      </p>

      <div className="pckt-share-packet" style={{ marginTop: 24 }}>
        <Packet
          width={220}
          height={310}
          amount={packet ? String(Math.floor(Number(packet.current_capacity) / 100000000)) : '0'}
          from="you"
          message={packet?.message_body || ''}
          variant="foil"
        />
      </div>

      {loading && (
        <div style={{ marginTop: 24, color: 'var(--fg-muted)' }}>Loading link…</div>
      )}

      {error && !showPairing && (
        <div style={{ marginTop: 16, width: '100%', maxWidth: 440 }}>
          <Alert
            tone="error"
            title={error.title}
            message={error.message}
            hint={error.hint}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {showPairing && (
        <div className="pckt-share-card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            This device hasn't been paired with the sender yet. Paste a pair code from a device
            that already has access (Settings → Pair code on your other device), or copy this
            device's token to your other device's storage.
          </div>
          <input
            value={pairCode}
            onChange={e => setPairCode(e.target.value)}
            placeholder="paste pair code"
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 14,
              color: 'var(--fg)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
            <Button variant="primary" size="lg" full onClick={submitPair} disabled={pairing || !owns}>
              {pairing ? 'Pairing…' : 'Pair (signed in as owner)'}
            </Button>
            <Button variant="ghost" size="lg" full onClick={usePastedToken}>
              Use as my token
            </Button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-quiet)', fontFamily: 'var(--font-mono)' }}>
            This device's token: {getOrCreateDeviceToken()}
          </div>
        </div>
      )}

      {link && (
        <div className="pckt-share-card" style={{ marginTop: 16 }}>
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
                fontSize: 14,
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
              full
              onClick={() => copy(link)}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button variant="ghost" size="lg" icon="share" full onClick={share}>
              Share
            </Button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Button variant="ghost" size="lg" onClick={onBack}>
          Back to packets
        </Button>
      </div>

      {toast && (
        <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />
      )}
      {pill && <CopyPill message={pill} onClose={() => setPill(null)} />}
    </div>
  );
}
