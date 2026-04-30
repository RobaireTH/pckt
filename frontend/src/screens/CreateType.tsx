import { Button } from '../components/ui/Button';
import { Icon, IconName } from '../components/ui/Icon';
import { IconBtn } from '../components/ui/IconBtn';

export type PacketType = 'fixed' | 'lucky' | 'timed';

type Props = {
  selected: PacketType;
  onSelect: (t: PacketType) => void;
  onBack: () => void;
  onClose: () => void;
  onContinue: () => void;
};

type Option = {
  id: PacketType;
  title: string;
  sub: string;
  icon: IconName;
  flavor: string;
  disabled?: boolean;
  note?: string;
};

const options: Option[] = [
  {
    id: 'fixed',
    title: 'Fixed',
    sub: 'Each recipient gets the same amount.',
    icon: 'coins',
    flavor: 'For small groups — pay each the same',
  },
  {
    id: 'lucky',
    title: 'Lucky split',
    sub: 'Random amounts — first come, first served.',
    icon: 'shuffle',
    flavor: 'The classic red-packet ritual',
    disabled: true,
    note: 'Temporarily unavailable on the current testnet contract.',
  },
  {
    id: 'timed',
    title: 'Timed unlock',
    sub: 'Opens at a specific date & time.',
    icon: 'clock',
    flavor: 'New-Year countdowns, birthdays, reveals',
  },
];

export function CreateType({ selected, onSelect, onBack, onClose, onContinue }: Props) {
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
          New packet
        </div>
        <IconBtn name="close" onClick={onClose} />
      </header>
      <style>{`
        @media (min-width: 900px) { .pckt-create-mobile-header { display: none; } }
        .pckt-type-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (min-width: 900px) {
          .pckt-type-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 20px;
          }
        }
        .pckt-type-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px;
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          font-family: var(--font-sans);
          color: var(--fg);
          transition: background 120ms var(--ease-out), border-color 120ms var(--ease-out);
        }
        @media (min-width: 900px) {
          .pckt-type-card {
            flex-direction: column;
            padding: 28px;
            min-height: 220px;
            gap: 18px;
          }
        }
        .pckt-type-card:hover { border-color: var(--border-strong); }
      `}</style>

      <div
        className="pckt-create-layout-single"
        style={{
          flex: 1,
          maxWidth: 1100,
          margin: '0 auto',
          width: '100%',
          padding: '28px 20px',
        }}
      >
        <div className="t-eyebrow" style={{ color: 'var(--crimson-600)', marginBottom: 6 }}>
          Step 1 of 3
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 32,
            margin: 0,
            letterSpacing: '-0.02em',
            color: 'var(--fg)',
          }}
          className="pckt-section-title"
        >
          How should it open?
        </h1>
        <p
          style={{
            fontSize: 15,
            color: 'var(--fg-muted)',
            lineHeight: 1.55,
            margin: '10px 0 28px',
            maxWidth: 560,
          }}
        >
          Pick the ritual that fits the moment. You can change message and amount next.
        </p>

        <div className="pckt-type-grid">
          {options.map(o => {
            const isActive = selected === o.id;
            return (
              <button
                key={o.id}
                className="pckt-type-card"
                onClick={() => onSelect(o.id)}
                disabled={o.disabled}
                style={{
                  background: isActive ? 'var(--accent-weak)' : 'var(--bg-elev)',
                  border: `1px solid ${
                    isActive ? 'var(--accent)' : 'var(--border)'
                  }`,
                  opacity: o.disabled ? 0.55 : 1,
                  cursor: o.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: isActive ? 'var(--accent)' : 'var(--bg-elev-2)',
                    color: isActive ? 'var(--ink-10)' : 'var(--fg-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={o.icon} size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 22,
                      letterSpacing: '-0.01em',
                      color: 'var(--fg)',
                      marginBottom: 4,
                    }}
                  >
                    {o.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--fg-muted)',
                      lineHeight: 1.5,
                      marginBottom: 10,
                    }}
                  >
                    {o.sub}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--fg-quiet)',
                      letterSpacing: '.04em',
                    }}
                  >
                    {o.flavor}
                  </div>
                  {o.note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--danger)',
                        lineHeight: 1.5,
                        marginTop: 8,
                      }}
                    >
                      {o.note}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${
                      isActive ? 'var(--accent)' : 'var(--border-strong)'
                    }`,
                    background: isActive ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                >
                  {isActive && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--ink-10)',
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 12,
            color: 'var(--fg-muted)',
            lineHeight: 1.5,
            maxWidth: 620,
          }}
        >
          Lucky split is disabled on the current testnet deployment because the live contract can
          produce sub-minimum claim amounts that fail on-chain. Use Fixed or Timed for now.
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            size="lg"
            iconRight="arrow_right"
            onClick={onContinue}
            style={{ width: '100%', maxWidth: 320 }}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
