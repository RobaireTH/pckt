import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { IconBtn } from '../components/ui/IconBtn';
import { Packet } from '../components/Packet';
import { useWallet } from '../hooks/useWallet';
import { formatDateTime } from '../locale';
import { SAFE_SLOT_PAYOUT_SHANNONS, minimumFixedPacketAmount, packetFloor, toCkb } from '../packets';
import { PacketType } from './CreateType';

const amountPresets = ['88', '188', '888', '1888', '8888'];
const slotPresets = [5, 10, 20, 50];
const messagePresets = [
  { label: 'Fold · Seal · Send', full: 'Fold · Seal · Send' },
  { label: 'With gratitude', full: 'With gratitude' },
  { label: 'For luck', full: 'For luck' },
  { label: 'gm', full: 'gm' },
];
const SHANNONS = 100_000_000n;

export type Draft = {
  type: PacketType;
  amount: string;
  slots: number;
  message: string;
  unlock: string;
};

type Props = {
  draft: Draft;
  onPatch: (p: Partial<Draft>) => void;
  onBack: () => void;
  onReview: () => void;
  onClose: () => void;
};

const labels: Record<
  PacketType,
  { title: string; nav: string; blurb: string; slotsNote: (slots: number, avg: number) => string }
> = {
  fixed: {
    title: 'Fixed amount',
    nav: 'Fixed',
    blurb: 'Everyone gets the same amount — simple and even.',
    slotsNote: (slots, avg) => `${slots} recipients · ${avg} CKB each`,
  },
  lucky: {
    title: 'Lucky split',
    nav: 'Lucky split',
    blurb: 'Random amounts, first-come-first-served.',
    slotsNote: (_slots, avg) => `Random amounts · avg. ${avg} CKB each`,
  },
  timed: {
    title: 'Timed unlock',
    nav: 'Timed unlock',
    blurb: 'Sealed until the unlock time. Everyone opens together.',
    slotsNote: (slots, avg) => `${slots} recipients · avg. ${avg} CKB each`,
  },
};

export function CreateAmount({ draft, onPatch, onBack, onReview, onClose }: Props) {
  const { type, amount, slots, message, unlock } = draft;
  const { balance } = useWallet();
  const numAmount = Number(amount) || 0;
  const amountShannons = amount ? BigInt(amount) * SHANNONS : 0n;
  const avg = slots > 0 ? Math.max(1, Math.round(numAmount / slots)) : 0;
  const reserveCkb = toCkb(packetFloor(slots, message));
  const totalNeededCkb = numAmount + reserveCkb;
  const minPerSlotCkb = toCkb(SAFE_SLOT_PAYOUT_SHANNONS);
  const minFixedTotalCkb = toCkb(minimumFixedPacketAmount(slots));
  const walletBalanceCkb = balance ? toCkb(balance) : null;
  const L = labels[type];
  const luckyUnavailable = type === 'lucky';
  const fixedTooSmall = type !== 'lucky' && amountShannons > 0n && amountShannons < minimumFixedPacketAmount(slots);
  const validationMessage = luckyUnavailable
    ? 'Lucky split is temporarily unavailable on the current testnet contract because it can create unclaimable dust payouts.'
    : fixedTooSmall
    ? `This packet needs at least ${minFixedTotalCkb.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} CKB total so each claim is at least ${minPerSlotCkb.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} CKB.`
    : null;
  const canReview = numAmount > 0 && !validationMessage;

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
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>
          {L.nav}
        </div>
        <IconBtn name="close" onClick={onClose} />
      </header>
      <style>{`
        @media (min-width: 900px) { .pckt-create-mobile-header { display: none; } }
        .pckt-amount-input::placeholder { color: var(--fg-quiet); }
      `}</style>

      <div className="pckt-create-layout">
        <div>
          <div style={{ padding: '24px 20px 0' }}>
            <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', marginBottom: 6 }}>
              Step 2 of 3 · {L.nav}
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
              {L.title}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
              {L.blurb}
            </p>
          </div>

          <section style={{ textAlign: 'center', padding: '36px 20px 28px' }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--fg-muted)',
                letterSpacing: '.15em',
                textTransform: 'uppercase',
                marginBottom: 10,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Total · tap to edit
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10 }}>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={e =>
                  onPatch({ amount: e.target.value.replace(/\D/g, '').slice(0, 7) })
                }
                placeholder="0"
                className="pckt-create-total-num pckt-amount-input"
                aria-label="Total amount in CKB"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 88,
                  letterSpacing: '-0.04em',
                  color: 'var(--fg)',
                  lineHeight: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  textAlign: 'center',
                  width: `${Math.max(1, amount.length) + 0.5}ch`,
                  padding: 0,
                  caretColor: 'var(--crimson-600)',
                }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--fg-muted)' }}>
                CKB
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--fg-quiet)',
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
              }}
            >
              ≈ ${(numAmount / 100).toFixed(2)} USD
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--fg-muted)',
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Needs about {totalNeededCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              CKB total now
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--fg-quiet)',
                marginTop: 6,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {reserveCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB reserve stays
              in the packet cell for CKB storage
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--fg-quiet)',
                marginTop: 6,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Fixed and timed packets should target at least{' '}
              {minPerSlotCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB per claim.
            </div>
            {walletBalanceCkb !== null && (
              <div
                style={{
                  fontSize: 11,
                  color: walletBalanceCkb >= totalNeededCkb ? 'var(--fg-quiet)' : 'var(--danger)',
                  marginTop: 6,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Wallet balance: {walletBalanceCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 6,
                justifyContent: 'center',
                marginTop: 20,
                flexWrap: 'wrap',
              }}
            >
              {amountPresets.map(v => (
                <Chip key={v} active={v === amount} onClick={() => onPatch({ amount: v })}>
                  {v}
                </Chip>
              ))}
            </div>
            {validationMessage && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  background: 'rgba(126,20,24,.08)',
                  border: '1px solid rgba(126,20,24,.18)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'var(--danger)',
                  lineHeight: 1.5,
                }}
              >
                {validationMessage}
              </div>
            )}
          </section>

          <section
            style={{
              padding: '22px 20px',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Recipients</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                  {L.slotsNote(slots, avg)}
                </div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 28,
                  color: 'var(--fg)',
                  lineHeight: 1,
                  paddingTop: 2,
                }}
              >
                {slots}
              </div>
            </div>
            <input
              type="range"
              min={2}
              max={50}
              value={slots}
              onChange={e => onPatch({ slots: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--crimson-600)' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--fg-quiet)',
                fontFamily: 'var(--font-mono)',
                marginTop: 4,
              }}
            >
              <span>2</span>
              <span>50</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {slotPresets.map(n => (
                <Chip key={n} active={n === slots} onClick={() => onPatch({ slots: n })}>
                  {n}
                </Chip>
              ))}
            </div>
          </section>

          {type === 'timed' && (
            <section
              style={{ padding: '22px 20px', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 8 }}>
                Unlocks at
              </div>
              <input
                type="datetime-local"
                value={unlock}
                onChange={e => onPatch({ unlock: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 15,
                  color: 'var(--fg)',
                  outline: 'none',
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--fg-quiet)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 8,
                  letterSpacing: '.04em',
                }}
              >
                Sealed until this time. Recipients see the packet but can't open it yet.
              </div>
            </section>
          )}

          <section style={{ padding: '22px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 8 }}>
              Message
            </div>
            <textarea
              value={message}
              onChange={e => onPatch({ message: e.target.value.slice(0, 120) })}
              rows={3}
              placeholder="A short note for recipients"
              maxLength={120}
              style={{
                width: '100%',
                padding: 14,
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                color: 'var(--fg)',
                fontStyle: 'italic',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--fg-quiet)', fontFamily: 'var(--font-mono)' }}>
                {message.length} / 120
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {messagePresets.map(s => (
                <Chip key={s.label} onClick={() => onPatch({ message: s.full })}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </section>

          <div className="pckt-create-mobile-cta" style={{ padding: '20px 20px 32px' }}>
            <Button
              variant="primary"
              size="lg"
              full
              iconRight="arrow_right"
              onClick={onReview}
              disabled={!canReview}
            >
              Review
            </Button>
          </div>
          <style>{`
            @media (min-width: 900px) { .pckt-create-mobile-cta { display: none; } }
          `}</style>
        </div>

        <aside className="pckt-create-preview">
          <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', alignSelf: 'flex-start' }}>
            Live preview · {L.nav}
          </div>
          <Packet
            width={260}
            height={368}
            amount={amount || '0'}
            from="your wallet"
            message={message}
            variant="crimson"
          />
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              background: 'var(--border)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <Stat label="Total" value={`${amount || '0'} CKB`} />
            <Stat label="Slots" value={String(slots)} />
            <Stat label={type === 'lucky' ? 'Avg. each' : 'Each'} value={`${avg} CKB`} />
            <Stat
              label={type === 'timed' ? 'Unlocks' : 'Expires'}
              value={
                type === 'timed'
                  ? formatDateTime(unlock)
                  : '7 days'
              }
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            full
            iconRight="arrow_right"
            onClick={onReview}
            disabled={!canReview}
          >
            Review &amp; seal
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-elev)', padding: '14px 16px' }}>
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
          fontSize: 18,
          color: 'var(--fg)',
          letterSpacing: '-0.01em',
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
