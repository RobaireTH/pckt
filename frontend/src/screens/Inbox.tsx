import { Button } from '../components/ui/Button';
import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Chip } from '../components/ui/Chip';
import { Packet } from '../components/Packet';
import type { PacketSummary } from '../api';
import { useWallet } from '../hooks/useWallet';
import { formatDate, formatDateTime } from '../locale';
import { ownerLabel, packetMoment, packetTypeInfo } from '../packets';
import { buildAndRelayReclaimTx } from '../tx';

type InboxItem = {
  id: string;
  from: string;
  message: string;
  status: 'open' | 'timed' | 'claimed' | 'expired';
  variant: 'crimson' | 'ink' | 'foil';
  kind: string;
  amount?: string;
  meta: string;
  when: string;
  expiry: number;
};

type Filter = 'all' | 'open' | 'past';

type Props = { packets: PacketSummary[]; onRefresh: () => void };

export function Inbox({ packets, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [reclaimingId, setReclaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { wallet, signer, openConnect } = useWallet();
  const now = Math.floor(Date.now() / 1000);
  const items: InboxItem[] = packets.map(p => {
    const open = p.slots_claimed < p.slots_total && p.unlock_time <= now && p.expiry > now;
    const timed = p.unlock_time > now && p.expiry > now;
    const expired = p.expiry <= now;
    const status: InboxItem['status'] =
      open ? 'open' : timed ? 'timed' : expired ? 'expired' : 'claimed';
    const info = packetTypeInfo(p.packet_type);
    return {
      id: p.out_point,
      from: ownerLabel(p.owner_lock_hash, 'sender', p.owner_address, p.owner_name),
      message: p.message_body || 'A packet for you',
      status,
      variant: status === 'claimed' ? 'foil' : info.variant,
      kind: info.shortLabel,
      expiry: p.expiry,
      meta:
        status === 'timed'
          ? `unlocks at ${formatDateTime(p.unlock_time * 1000)}`
          : `${Math.max(0, p.slots_total - p.slots_claimed)} of ${p.slots_total} slots remain`,
      when: formatDate(packetMoment(p) * 1000),
    };
  });

  const visible = items.filter(item => {
    if (filter === 'open') return item.status === 'open' || item.status === 'timed';
    if (filter === 'past') return item.status === 'claimed' || item.status === 'expired';
    return true;
  });

  const openItems = visible.filter(i => i.status === 'open' || i.status === 'timed');
  const pastItems = visible.filter(i => i.status === 'claimed' || i.status === 'expired');

  const reclaim = async (item: InboxItem) => {
    if (!wallet || !signer) {
      openConnect();
      return;
    }
    setError(null);
    setSuccess(null);
    setReclaimingId(item.id);
    try {
      const result = await buildAndRelayReclaimTx({ outPoint: item.id, signer });
      setSuccess(`Reclaim submitted: ${result.txHash.slice(0, 14)}…${result.txHash.slice(-8)}`);
      onRefresh();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setReclaimingId(null);
    }
  };

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
          Packets
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: '6px 0 0' }}>
          Live state for packets you've sealed on testnet.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 6, padding: '16px 20px 0', flexWrap: 'wrap' }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All · {items.length}
        </Chip>
        <Chip active={filter === 'open'} onClick={() => setFilter('open')}>
          Open · {items.filter(i => i.status === 'open' || i.status === 'timed').length}
        </Chip>
        <Chip active={filter === 'past'} onClick={() => setFilter('past')}>
          Past · {items.filter(i => i.status === 'claimed' || i.status === 'expired').length}
        </Chip>
      </div>

      {(error || success) && (
        <div style={{ padding: '12px 20px 0' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: success ? 'rgba(74,138,92,.12)' : 'rgba(126,20,24,.08)',
              border: `1px solid ${success ? 'rgba(74,138,92,.24)' : 'rgba(126,20,24,.16)'}`,
              color: success ? 'var(--ok)' : 'var(--danger)',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {success || error}
          </div>
        </div>
      )}

      {openItems.length > 0 && (
        <Section title="Open">
          {openItems.map(item => (
            <InboxRow key={item.id} item={item} />
          ))}
        </Section>
      )}

      {pastItems.length > 0 && (
        <Section title="Past">
          {pastItems.map(item => (
            <InboxRow
              key={item.id}
              item={item}
              actionLabel={item.status === 'expired' ? 'Reclaim' : undefined}
              actionLoading={reclaimingId === item.id}
              onAction={item.status === 'expired' ? () => reclaim(item) : undefined}
            />
          ))}
        </Section>
      )}

      {visible.length === 0 && (
        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
            color: 'var(--fg-muted)',
            fontSize: 14,
          }}
        >
          Nothing here yet.
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div
        className="pckt-section-head"
        style={{
          padding: '20px 20px 8px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 18,
            letterSpacing: '-0.01em',
            color: 'var(--fg)',
            margin: 0,
            fontWeight: 400,
          }}
        >
          {title}
        </h2>
      </div>
      <div className="pckt-inbox-list">{children}</div>
    </section>
  );
}

function InboxRow({
  item,
  onClick,
  onAction,
  actionLabel,
  actionLoading,
}: {
  item: InboxItem;
  onClick?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  actionLoading?: boolean;
}) {
  const clickable = !!onClick;
  const statusTint: Record<InboxItem['status'], { bg: string; fg: string; label: string }> = {
    open: { bg: 'rgba(126,20,24,.12)', fg: 'var(--crimson-600)', label: 'Open' },
    timed: { bg: 'rgba(212,180,106,.18)', fg: '#8a6b24', label: 'Timed' },
    claimed: { bg: 'rgba(74,138,92,.14)', fg: 'var(--ok)', label: 'Claimed' },
    expired: { bg: 'var(--bg-elev-2)', fg: 'var(--fg-quiet)', label: 'Expired' },
  };
  const tint = statusTint[item.status];

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={e => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderTop: '1px solid var(--border)',
        cursor: clickable ? 'pointer' : 'default',
        opacity: item.status === 'expired' ? 0.6 : 1,
      }}
    >
      <div style={{ width: 48, height: 68, flexShrink: 0, borderRadius: 6, overflow: 'hidden' }}>
        <Packet
          width={48}
          height={68}
          amount=""
          message=""
          from=""
          variant={item.variant}
          status={item.status === 'claimed' ? 'claimed' : 'sealed'}
          style={{ borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: 'var(--fg)',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.from}
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              background: tint.bg,
              color: tint.fg,
              padding: '2px 7px',
              borderRadius: 4,
            }}
          >
            {tint.label}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--fg-muted)',
            marginTop: 3,
            fontStyle: 'italic',
            fontFamily: 'var(--font-serif)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          “{item.message}”
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-quiet)',
            fontFamily: 'var(--font-mono)',
            marginTop: 3,
            letterSpacing: '.02em',
          }}
        >
          {item.kind} · {item.meta}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {onAction && actionLabel ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={e => {
              e.stopPropagation();
              onAction();
            }}
            disabled={actionLoading}
          >
            {actionLoading ? 'Reclaiming…' : actionLabel}
          </Button>
        ) : item.amount ? (
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              color: 'var(--ok)',
            }}
          >
            {item.amount}
          </div>
        ) : clickable ? (
          <div style={{ color: 'var(--crimson-600)' }}>
            <Icon name="chev_right" size={20} />
          </div>
        ) : null}
        <div
          style={{
            fontSize: 11,
            color: 'var(--fg-quiet)',
            fontFamily: 'var(--font-mono)',
            marginTop: 2,
          }}
        >
          {item.when}
        </div>
      </div>
    </div>
  );
}
