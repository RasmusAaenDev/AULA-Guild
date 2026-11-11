import type { ReactNode } from 'react';

export type IconName = 'overblik' | 'kalender' | 'filer' | 'galleri' | 'chat' | 'sim' | 'kontakter' | 'deltager' | 'maaske' | 'afbud' | 'opret' | 'opslag' | 'bogmaerke' | 'udraab' | 'luk' | 'pil-ned' | 'klovn' | 'fake' | 'person' | 'gruppe';

const paths: Record<IconName, ReactNode> = {
  overblik: <path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />,
  kalender: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  filer: <path d="M4 5h6l2 2h8v12H4z" />,
  galleri: (
    <>
      <path d="M3 5h18v14H3z" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="16" cy="9" r="1.5" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  sim: <path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-7" />,
  kontakter: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M16 5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.4 3.5 6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 21c0-4.5 3-7 7-7s7 2.5 7 7" />
    </>
  ),
  gruppe: (
    <>
      <circle cx="12" cy="7" r="2.8" />
      <path d="M7 19c0-3.4 2.2-5.2 5-5.2s5 1.8 5 5.2" />
      <circle cx="5" cy="9.5" r="2.2" />
      <path d="M1.5 19c0-2.8 1.5-4.4 3.5-4.4" />
      <circle cx="19" cy="9.5" r="2.2" />
      <path d="M22.5 19c0-2.8-1.5-4.4-3.5-4.4" />
    </>
  ),
  deltager: <path d="M5 12.5l4.5 4.5L19 7" />,
  maaske: (
    <>
      <path d="M9 9a3 3 0 115 2c-1.2.9-2 1.4-2 3" />
      <path d="M12 18v.5" />
    </>
  ),
  afbud: <path d="M6 6l12 12M18 6L6 18" />,
  opret: <path d="M12 5v14M5 12h14" />,
  opslag: <path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5" />,
  bogmaerke: <path d="M7 4h10v16l-5-4-5 4z" />,
  udraab: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  luk: <path d="M6 6l12 12M18 6L6 18" />,
  'pil-ned': <path d="M6 9l6 6 6-6" />,
  /** Klovn/narr: narrehue med tre spidser og bjælder, simpelt ansigt. */
  klovn: (
    <>
      <path d="M5 11L4 6l5 2.5L12 5l3 3.5L20 6l-1 5z" />
      <circle cx="4" cy="4.8" r="1" />
      <circle cx="12" cy="3.2" r="1" />
      <circle cx="20" cy="4.8" r="1" />
      <path d="M6.5 11v3.5a5.5 5.5 0 0 0 11 0V11" />
      <path d="M9.8 14.5v.01M14.2 14.5v.01M9.5 17.3c1.4 1.1 3.6 1.1 5 0" />
    </>
  ),
  fake: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </>
  ),
};

/** Simpelt 24×24 stregikon i currentColor; skjult for skærmlæsere (teksten ved siden af bærer meningen). */
export function Icon({ name, size = 24, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="icon"
      data-icon={name}
    >
      {paths[name]}
    </svg>
  );
}
