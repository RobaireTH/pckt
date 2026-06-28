export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8181';
export const CKB_RPC_URL = import.meta.env.VITE_CKB_RPC_URL ?? 'https://testnet.ckb.dev/rpc';
export const EXPLORER_URL =
  import.meta.env.VITE_EXPLORER_URL ?? 'https://pudge.explorer.nervos.org';
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

export const CLAIM_BADGE = {
  enabled: import.meta.env.VITE_CLAIM_BADGE_ENABLED === 'true',
  codeHash: import.meta.env.VITE_CLAIM_BADGE_CODE_HASH as string | undefined,
  hashType: (import.meta.env.VITE_CLAIM_BADGE_HASH_TYPE ?? 'type') as
    | 'data'
    | 'data1'
    | 'data2'
    | 'type',
  txHash: import.meta.env.VITE_CLAIM_BADGE_TX_HASH as string | undefined,
  index: Number(import.meta.env.VITE_CLAIM_BADGE_INDEX ?? '0'),
  capacity: BigInt(import.meta.env.VITE_CLAIM_BADGE_CAPACITY_SHANNONS ?? '10000000000'),
};
