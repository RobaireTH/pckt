import { ReactNode } from 'react';

export type IconName =
  | 'arrow_right'
  | 'arrow_left'
  | 'arrow_up_right'
  | 'arrow_down'
  | 'plus'
  | 'check'
  | 'close'
  | 'copy'
  | 'link'
  | 'qr'
  | 'share'
  | 'sparkle'
  | 'lock'
  | 'clock'
  | 'shuffle'
  | 'split'
  | 'coins'
  | 'wallet'
  | 'user'
  | 'users'
  | 'calendar'
  | 'gas'
  | 'more'
  | 'chev_right'
  | 'chev_down'
  | 'chev_up'
  | 'home'
  | 'inbox'
  | 'settings'
  | 'search'
  | 'bell'
  | 'flame'
  | 'ckb'
  | 'seal'
  | 'scissors'
  | 'eye'
  | 'sun'
  | 'moon';

type Props = {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
};

const paths: Record<IconName, ReactNode> = {
  arrow_right: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  arrow_left: (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  arrow_up_right: (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  arrow_down: (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v13" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shuffle: (
    <>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </>
  ),
  split: (
    <>
      <path d="M12 3v6M12 15v6M6 12l6-6 6 6" />
    </>
  ),
  coins: (
    <>
      <circle cx="9" cy="9" r="6" />
      <path d="M15.5 15.5A6 6 0 1 1 9 9" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7V6a2 2 0 0 1 2-2h13v3" />
      <path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3" />
      <path d="M21 11h-5a2 2 0 0 0 0 4h5z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M22 20a7 7 0 0 0-5-6.7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  gas: (
    <>
      <rect x="3" y="6" width="10" height="14" rx="1" />
      <path d="M3 14h10" />
      <path d="M13 10h3a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  chev_right: <path d="m9 6 6 6-6 6" />,
  chev_down: <path d="m6 9 6 6 6-6" />,
  chev_up: <path d="m6 15 6-6 6 6" />,
  home: (
    <>
      <path d="M3 12 12 4l9 8" />
      <path d="M5 11v9h14v-9" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l1 2h6l1-2h5" />
      <path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.8a7 7 0 0 0-2.3-1.3L14 3h-4l-.3 2.3a7 7 0 0 0-2.3 1.3l-2.3-.8-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.8a7 7 0 0 0 2.3 1.3L10 21h4l.3-2.3a7 7 0 0 0 2.3-1.3l2.3.8 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  flame: <path d="M12 3c2 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z" />,
  ckb: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M9 4v16M4 9h16M15 4v16M4 15h16" />
    </>
  ),
  seal: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20.5 14.5A8 8 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />,
};

export function Icon({ name, size = 18, stroke = 1.5, color = 'currentColor' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
