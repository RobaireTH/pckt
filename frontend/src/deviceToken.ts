const STORAGE_KEY = 'pckt:deviceToken';

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

export function getOrCreateDeviceToken(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;
  } catch {}
  const fresh = generateToken();
  try {
    localStorage.setItem(STORAGE_KEY, fresh);
  } catch {}
  return fresh;
}

export function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setDeviceToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {}
}
