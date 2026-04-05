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
  const h = window.location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'landing';
}

function defaultUnlock() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function initialDraft(): Draft {
  return {
    type: 'lucky',
    amount: '888',
    slots: 20,
    message: 'Fold · Seal · Send',
    unlock: defaultUnlock(),
  };
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const { wallet, openConnect } = useWallet();

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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

  const onSealAttempt = () => {
    if (wallet) go('create-share');
    else openConnect();
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
      {route === 'app' && <Home onSend={() => go('create')} onClaim={() => go('inbox')} />}
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
          onSeal={onSealAttempt}
          onClose={() => go('app')}
        />
      )}
      {route === 'create-share' && (
        <CreateShare draft={draft} onAnother={startNewDraft} onHome={() => go('app')} />
      )}
      {route === 'claim' && <Claim onOpen={() => go('app')} />}
      {route === 'inbox' && <Inbox onOpen={() => go('claim')} />}
      {route === 'activity' && <Activity />}
      {route === 'me' && <Profile />}
    </AppShell>
  );
}
