import { useEffect, useState } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';

export type DisplayWallet = {
  walletName: string;
  walletIcon: string;
  address: string;
  shortAddress: string;
  initials: string;
};

function shorten(a: string) {
  if (!a) return '';
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function useWallet() {
  const { wallet, signerInfo, isOpen, open, close, disconnect } = useCcc();
  const [address, setAddress] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!signerInfo?.signer) {
      setAddress('');
      return;
    }
    signerInfo.signer.getRecommendedAddress().then(
      addr => {
        if (!cancelled) setAddress(addr);
      },
      () => {
        /* ignore */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [signerInfo]);

  const displayed: DisplayWallet | null =
    wallet && signerInfo
      ? {
          walletName: wallet.name,
          walletIcon: wallet.icon,
          address,
          shortAddress: address ? shorten(address) : '—',
          initials: (address || wallet.name).slice(0, 2).toUpperCase(),
        }
      : null;

  return {
    wallet: displayed,
    isConnectOpen: isOpen,
    openConnect: open,
    closeConnect: close,
    disconnect,
  };
}
