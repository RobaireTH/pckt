export type FriendlyContext = 'seal' | 'claim' | 'reclaim' | 'profile' | 'share';

export type FriendlyError = {
  title: string;
  message: string;
  hint?: string;
};

const REJECT_PATTERNS = [
  /user\s+rejected/i,
  /user\s+denied/i,
  /denied\s+by\s+user/i,
  /user\s+canceled/i,
  /user\s+cancelled/i,
  /\brejected the request\b/i,
  /\baction[_\s]rejected\b/i,
];

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /\benetwork\b/i,
  /\beconnreset\b/i,
  /\bconnection refused\b/i,
  /\btimed?\s*out\b/i,
];

const INSUFFICIENT_PATTERNS = [
  /insufficient/i,
  /not enough/i,
  /\binsufficien/i,
  /required\s+\d+.*available/i,
  /capacity\s+overflow/i,
  /balance.*low/i,
];

const CAPACITY_PATTERNS = [/capacity/i, /shannons/i];

function stripPrefix(s: string): string {
  return s.replace(/^Error:\s*/, '').trim();
}

function ctxLabel(context: FriendlyContext): string {
  switch (context) {
    case 'seal':
      return 'Could not seal this packet';
    case 'claim':
      return 'Could not claim this packet';
    case 'reclaim':
      return 'Could not reclaim this packet';
    case 'profile':
      return 'Could not save profile';
    case 'share':
      return 'Could not share this link';
  }
}

export function friendlyError(raw: unknown, context: FriendlyContext): FriendlyError {
  const text = stripPrefix(typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : String(raw));

  if (REJECT_PATTERNS.some(re => re.test(text))) {
    return {
      title: 'Request canceled',
      message: 'Your wallet rejected this request. Try again when you are ready.',
    };
  }

  if (NETWORK_PATTERNS.some(re => re.test(text))) {
    return {
      title: 'Network unreachable',
      message: 'Could not reach the network. Check your connection and try again.',
    };
  }

  if (text.includes('error code 55') || /already\s+claimed/i.test(text)) {
    return {
      title: 'Already claimed',
      message: 'This wallet already claimed a slot from this packet.',
    };
  }
  if (text.includes('error code 54') || /fully\s+claimed/i.test(text)) {
    return {
      title: 'Packet emptied',
      message: 'Every slot in this packet has already been claimed.',
    };
  }
  if (text.includes('error code 53') || /still\s+sealed/i.test(text) || /too\s+early/i.test(text)) {
    return {
      title: 'Not unlocked yet',
      message: 'This packet is still sealed and cannot be claimed yet.',
    };
  }
  if (text.includes('error code 80') || /reclaim.*expir/i.test(text)) {
    return {
      title: 'Not yet reclaimable',
      message: 'This packet has not reached its expiry yet, so it cannot be reclaimed.',
    };
  }

  if (INSUFFICIENT_PATTERNS.some(re => re.test(text))) {
    if (context === 'seal') {
      return {
        title: 'Not enough CKB to seal',
        message: 'Your wallet does not have enough CKB to fund this packet plus the cell reserve and network fee.',
        hint: 'Lower the amount or top up your wallet, then try again.',
      };
    }
    if (context === 'reclaim') {
      return {
        title: 'Not enough CKB to reclaim',
        message: 'Your wallet needs a small amount of CKB to pay the network fee for the reclaim transaction.',
      };
    }
    return {
      title: 'Not enough CKB',
      message: 'Your wallet does not have enough CKB to complete this transaction.',
    };
  }

  if (CAPACITY_PATTERNS.some(re => re.test(text))) {
    return {
      title: ctxLabel(context),
      message: 'A cell capacity check failed. The amount may be too small for the chosen lock or slot count.',
      hint: 'Try a slightly larger amount or fewer slots.',
    };
  }

  return {
    title: ctxLabel(context),
    message: text || 'Something went wrong. Please try again.',
  };
}

export function friendlyMessage(raw: unknown, context: FriendlyContext): string {
  const fe = friendlyError(raw, context);
  return fe.hint ? `${fe.message} ${fe.hint}` : fe.message;
}
