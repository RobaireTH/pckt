import { useEffect, useState } from 'react';
import { useCcc, Script, type Signer, type Client } from '@ckb-ccc/connector-react';

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
  const { wallet, signerInfo, client, isOpen, open, close, disconnect } = useCcc();
  const [address, setAddress] = useState('');
  const [lockHash, setLockHash] = useState<string | null>(null);
  const [lockScript, setLockScript] = useState<Script | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!signerInfo?.signer) {
      setAddress('');
      setLockHash(null);
      setLockScript(null);
      return;
    }
    const signer = signerInfo.signer;
    signer.getRecommendedAddress().then(
      addr => {
        if (!cancelled) setAddress(addr);
      },
      () => {
        /* ignore */
      },
    );
    signer.getRecommendedAddressObj().then(
      addrObj => {
        if (cancelled) return;
        const script = addrObj.script;
        setLockScript(script);
        setLockHash(script.hash());
      },
      () => {
        /* ignore */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [signerInfo]);

  const signer: Signer | null = signerInfo?.signer ?? null;

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
    signer,
    client: client as Client,
    lockHash,
    lockScript,
    isConnectOpen: isOpen,
    openConnect: open,
    closeConnect: close,
    disconnect,
  };
}
