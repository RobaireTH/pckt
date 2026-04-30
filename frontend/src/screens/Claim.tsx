import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Packet } from '../components/Packet';
import { fetchPacket, fetchPacketByPubkey, type PacketSummary } from '../api';
import { useWallet } from '../hooks/useWallet';
import { packetTypeInfo, predictClaimPayout, toCkb } from '../packets';
import { buildAndRelayClaimTx } from '../tx';

type Props = { onOpen: () => void; outPoint: string | null };

export function Claim({ onOpen, outPoint }: Props) {
  const [opened, setOpened] = useState(false);
  const [packet, setPacket] = useState<PacketSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [payout, setPayout] = useState<bigint | null>(null);
  const { signer, wallet, openConnect } = useWallet();

  const h = window.location.hash.replace(/^#\/?/, '');
  const pathOnly = h.split('?')[0];
  const routeParts = pathOnly.split('/').filter(Boolean);
  const pathPubkey = routeParts[1] || '';
  const pathSk = routeParts[2] || '';

  const idx = window.location.hash.indexOf('?');
  const queryPubkey =
    idx < 0 ? '' : new URLSearchParams(window.location.hash.slice(idx + 1)).get('pubkey') || '';
  const claimPubkey = pathPubkey || queryPubkey;
  const claimSk = pathSk;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const req = outPoint
      ? fetchPacket(outPoint)
      : claimPubkey
      ? fetchPacketByPubkey(claimPubkey)
      : Promise.reject(new Error('Open a pckt claim link to continue.'));
    req.then(
      p => {
        if (!cancelled) {
          setPacket(p);
          setPayout(predictClaimPayout(p));
        }
      },
      e => {
        if (!cancelled) setError(String(e));
      },
    ).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [outPoint, claimPubkey]);

  const from = packet
    ? `${packet.owner_lock_hash.slice(0, 6)}…${packet.owner_lock_hash.slice(-4)}`
    : 'unknown';
  const message = packet?.message_body || 'A packet for you';
  const remaining = packet ? Math.max(0, packet.slots_total - packet.slots_claimed) : 0;
  const totalCkb = packet ? Math.floor(Number(packet.current_capacity) / 100000000) : 0;
  const expectedCkb = payout ? toCkb(payout) : 0;
  const previewAmount =
    expectedCkb > 0
      ? expectedCkb.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : String(totalCkb || '0');
  const targetOutPoint = outPoint || packet?.out_point || null;
  const typeInfo = packet ? packetTypeInfo(packet.packet_type) : null;

  const claimNow = async () => {
    if (!wallet || !signer) {
      openConnect();
      return;
    }
    if (!targetOutPoint) {
      setError('No packet selected');
      return;
    }
    if (!claimSk) {
      setError('Missing claim key in link');
      return;
    }
    setClaiming(true);
    setError(null);
    try {
      const result = await buildAndRelayClaimTx({
        outPoint: targetOutPoint,
        signer,
        claimPrivateKey: claimSk,
      });
      setPayout(result.payout);
      setOpened(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="pckt-claim-wrap">
      <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', marginBottom: 12 }}>
        A packet for you
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 36,
          letterSpacing: '-0.02em',
          marginBottom: 4,
          color: 'var(--fg)',
        }}
      >
        <em style={{ fontStyle: 'italic' }}>from</em> {from}
      </div>
      <div style={{ fontSize: 14, color: 'var(--fg-muted)', marginBottom: 28 }}>
        “{message}”
      </div>

      <div
        className="pckt-claim-packet"
        style={{
          animation: opened ? 'none' : 'pckt-float 3.6s ease-in-out infinite',
          transition: 'transform 400ms var(--ease-out)',
        }}
      >
        <Packet
          width={260}
          height={368}
          amount={previewAmount}
          from={from}
          message={message}
          status={opened ? 'claimed' : 'sealed'}
        />
      </div>

      <div style={{ marginTop: 36, width: '100%', maxWidth: 360 }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--fg-muted)', marginBottom: 12 }}>Loading claim details…</div>}
        {error && <div style={{ textAlign: 'center', color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        {!opened ? (
          <>
            <Button
              variant="primary"
              size="lg"
              full
              icon="sparkle"
              onClick={claimNow}
              disabled={claiming || loading}
            >
              {claiming ? 'Claiming…' : 'Open packet'}
            </Button>
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--fg-quiet)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '.08em',
                textAlign: 'center',
              }}
            >
              {typeInfo?.shortLabel ?? 'Packet'} · {remaining} of {packet?.slots_total ?? 0} slots remain
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 48,
                color: 'var(--crimson-600)',
                letterSpacing: '-0.02em',
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              +{previewAmount} CKB
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--fg-muted)',
                marginBottom: 18,
                textAlign: 'center',
              }}
            >
              Settled to your wallet.
            </div>
            <Button
              variant="primary"
              size="lg"
              full
              iconRight="arrow_right"
              onClick={onOpen}
            >
              View in wallet
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
