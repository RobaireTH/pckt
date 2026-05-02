import { useEffect, useState } from 'react';
import { Landing } from './screens/Landing';
import { Home } from './screens/Home';
import { CreateType, PacketType } from './screens/CreateType';
import { CreateAmount, Draft } from './screens/CreateAmount';
import { CreateReview } from './screens/CreateReview';
import { CreateShare } from './screens/CreateShare';
import { Claim } from './screens/Claim';
import { Inbox } from './screens/Inbox';
import { Activity } from './screens/Activity';
import { Profile } from './screens/Profile';
import { AppShell } from './components/layout/AppShell';
import { Button } from './components/ui/Button';
import { Alert } from './components/ui/Alert';
import { useWallet } from './hooks/useWallet';
import { useNotifications } from './hooks/useNotifications';
import { friendlyError } from './errors';
import {
  fetchClaimedPackets,
  fetchCkbPrice,
  fetchPackets,
  fetchSenderProfile,
  saveSenderProfile,
  type ClaimedPacket,
  type PacketSummary,
  type SenderProfile,
} from './api';

export type Route =
  | 'landing'
  | 'app'
  | 'create'
  | 'create-amount'
  | 'create-review'
  | 'create-share'
  | 'claim'
  | 'inbox'
  | 'activity'
  | 'me';

const ROUTES: Route[] = [
  'landing',
  'app',
  'create',
  'create-amount',
  'create-review',
  'create-share',
  'claim',
  'inbox',
  'activity',
  'me',
];

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const base = h.split(/[/?]/)[0] as Route;
  const route = base.split('#')[0] as Route;
  return ROUTES.includes(route) ? route : 'landing';
}

function defaultUnlock() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function initialDraft(): Draft {
  return {
    type: 'fixed',
    amount: '888',
    slots: 20,
    message: 'Fold · Seal · Send',
    unlock: defaultUnlock(),
  };
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const { wallet, lockHash } = useWallet();
  const [sentPackets, setSentPackets] = useState<PacketSummary[]>([]);
  const [claimedPackets, setClaimedPackets] = useState<ClaimedPacket[]>([]);
  const [senderProfile, setSenderProfile] = useState<SenderProfile | null>(null);
  const [profilePromptOpen, setProfilePromptOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedOutPoint, setSelectedOutPoint] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [lastSeal, setLastSeal] = useState<{
    txHash: string;
    claimLink: string;
    publicShortLink: string;
  } | null>(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!lockHash) {
      setSentPackets([]);
      setClaimedPackets([]);
      return;
    }
    // Backend indexes packets by the lock script hash (`owner_lock_hash`),
    // not the human-readable wallet address.
    const load = () => {
      Promise.allSettled([fetchPackets(lockHash), fetchClaimedPackets(lockHash)]).then(results => {
        if (cancelled) return;
        const [sent, claimed] = results;
        setSentPackets(sent.status === 'fulfilled' ? sent.value : []);
        setClaimedPackets(claimed.status === 'fulfilled' ? claimed.value : []);
      });
    };
    load();
    // Background poll so notifications fire when state changes off-screen.
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [lockHash, route, refreshNonce]);

  useNotifications({ sentPackets, claimedPackets, enabled: !!lockHash });

  useEffect(() => {
    let cancelled = false;
    if (!lockHash) {
      setSenderProfile(null);
      setProfilePromptOpen(false);
      setProfileDraft('');
      setProfileError(null);
      return;
    }

    fetchSenderProfile(lockHash).then(
      profile => {
        if (cancelled) return;
        setSenderProfile(profile);
        setProfileDraft(profile.username);
        setProfilePromptOpen(false);
        setProfileError(null);
      },
      err => {
        if (cancelled) return;
        const msg = String(err);
        if (msg.includes('not found') || msg.includes('404')) {
          setSenderProfile(null);
          setProfileDraft('');
          setProfilePromptOpen(true);
          setProfileError(null);
          return;
        }
        setProfileError(friendlyError(err, 'profile').message);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [lockHash]);

  useEffect(() => {
    let cancelled = false;
    fetchCkbPrice().then(
      p => {
        if (!cancelled) setPriceUsd(p.usd);
      },
      () => {
        if (!cancelled) setPriceUsd(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const go = (r: Route) => {
    window.location.hash = `#/${r}`;
  };
  const refreshPackets = () => setRefreshNonce(v => v + 1);
  const saveProfileName = async () => {
    if (!lockHash || !wallet?.address) return;
    const username = profileDraft.trim();
    if (username.length < 2 || username.length > 24) {
      setProfileError('Username must be between 2 and 24 characters.');
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    try {
      const profile = await saveSenderProfile({
        owner_lock_hash: lockHash,
        sender_address: wallet.address,
        username,
      });
      setSenderProfile(profile);
      setProfileDraft(profile.username);
      setProfilePromptOpen(false);
      setRefreshNonce(v => v + 1);
    } catch (e) {
      setProfileError(friendlyError(e, 'profile').message);
    } finally {
      setProfileSaving(false);
    }
  };

  const onPatch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));
  const setType = (t: PacketType) => onPatch({ type: t });

  const startNewDraft = () => {
    setDraft(initialDraft());
    go('create');
  };

  if (route === 'landing') {
    return <Landing onBegin={() => go('create')} onOpen={() => go('app')} />;
  }

  const activeTab =
    route === 'create' ||
    route === 'create-amount' ||
    route === 'create-review' ||
    route === 'create-share'
      ? 'create'
      : route === 'claim' || route === 'inbox'
      ? 'inbox'
      : route === 'activity'
      ? 'history'
      : route === 'me'
      ? 'me'
      : 'home';

  return (
    <AppShell active={activeTab} go={go}>
      {route === 'app' && (
        <Home
          onSend={() => go('create')}
          onClaim={() => go('inbox')}
          onOpenActivity={() => go('activity')}
          sentPackets={sentPackets}
          claimedPackets={claimedPackets}
          priceUsd={priceUsd}
        />
      )}
      {route === 'create' && (
        <CreateType
          selected={draft.type}
          onSelect={setType}
          onBack={() => go('app')}
          onClose={() => go('app')}
          onContinue={() => go('create-amount')}
        />
      )}
      {route === 'create-amount' && (
        <CreateAmount
          draft={draft}
          onPatch={onPatch}
          onBack={() => go('create')}
          onReview={() => go('create-review')}
          onClose={() => go('app')}
        />
      )}
      {route === 'create-review' && (
        <CreateReview
          draft={draft}
          onBack={() => go('create-amount')}
          onSeal={result => {
            setLastSeal(result);
            go('create-share');
          }}
          onClose={() => go('app')}
        />
      )}
      {route === 'create-share' && (
        <CreateShare
          draft={draft}
          onAnother={startNewDraft}
          onHome={() => go('app')}
          claimLink={lastSeal?.claimLink ?? `${window.location.origin}/#/claim`}
          publicShortLink={lastSeal?.publicShortLink ?? ''}
          txHash={lastSeal?.txHash ?? 'pending'}
        />
      )}
      {route === 'claim' && <Claim onOpen={() => go('app')} outPoint={selectedOutPoint} />}
      {route === 'inbox' && <Inbox packets={sentPackets} onRefresh={refreshPackets} />}
      {route === 'activity' && (
        <Activity sentPackets={sentPackets} claimedPackets={claimedPackets} />
      )}
      {route === 'me' && (
        <Profile
          sentPackets={sentPackets}
          claimedPackets={claimedPackets}
          priceUsd={priceUsd}
          senderProfile={senderProfile}
          onEditProfile={() => setProfilePromptOpen(true)}
        />
      )}
      {profilePromptOpen && wallet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,9,7,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--bg-elev)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 28,
                letterSpacing: '-0.02em',
                color: 'var(--fg)',
              }}
            >
              {senderProfile ? 'Edit sender name' : 'Choose your sender name'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
              This name is saved against your sender address in the app database and shown across
              packet cards instead of a raw lock hash.
            </div>
            <input
              value={profileDraft}
              onChange={e => setProfileDraft(e.target.value.slice(0, 24))}
              placeholder="e.g. shen.bit"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 16,
                color: 'var(--fg)',
                outline: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--fg-quiet)', fontFamily: 'var(--font-mono)' }}>
              {wallet.address}
            </div>
            {profileError && (
              <Alert
                tone="error"
                title="Could not save profile"
                message={profileError}
                onDismiss={() => setProfileError(null)}
              />
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              {senderProfile && (
                <Button variant="ghost" size="lg" full onClick={() => setProfilePromptOpen(false)}>
                  Cancel
                </Button>
              )}
              <Button variant="primary" size="lg" full onClick={saveProfileName} disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save name'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
