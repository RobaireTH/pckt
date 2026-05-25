export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8181';
export const CKB_RPC_URL = import.meta.env.VITE_CKB_RPC_URL ?? 'https://testnet.ckb.dev/rpc';
export const NETWORK = (import.meta.env.VITE_NETWORK ?? 'testnet') as
  | 'devnet'
  | 'testnet'
  | 'mainnet';

export const PCKT_LOCK = {
  codeHash: import.meta.env.VITE_PCKT_LOCK_CODE_HASH as string,
  hashType: (import.meta.env.VITE_PCKT_LOCK_HASH_TYPE ?? 'data1') as 'data1',
  txHash: import.meta.env.VITE_PCKT_LOCK_TX_HASH as string,
  index: Number(import.meta.env.VITE_PCKT_LOCK_INDEX ?? '0'),
};
