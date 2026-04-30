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
import { useWallet } from './hooks/useWallet';
import {
  fetchClaimedPackets,
  fetchCkbPrice,
  fetchPackets,
  type ClaimedPacket,
  type PacketSummary,
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
  const [selectedOutPoint, setSelectedOutPoint] = useState<string | null>(null);
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
    // Backend indexes packets by the lock script hash (`owner_lock_hash`),
    // not the human-readable wallet address.
    const owner = lockHash ?? undefined;
    const sentReq = fetchPackets(owner);
    const claimedReq = lockHash ? fetchClaimedPackets(lockHash) : Promise.resolve([]);
    Promise.allSettled([sentReq, claimedReq]).then(results => {
      if (cancelled) return;
      const [sent, claimed] = results;
      setSentPackets(sent.status === 'fulfilled' ? sent.value : []);
      setClaimedPackets(claimed.status === 'fulfilled' ? claimed.value : []);
    });
    return () => {
      cancelled = true;
    };
  }, [lockHash, route]);

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
          packets={sentPackets}
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
      {route === 'inbox' && <Inbox packets={sentPackets} />}
      {route === 'activity' && (
        <Activity sentPackets={sentPackets} claimedPackets={claimedPackets} />
      )}
      {route === 'me' && (
        <Profile sentPackets={sentPackets} claimedPackets={claimedPackets} priceUsd={priceUsd} />
      )}
    </AppShell>
  );
}
