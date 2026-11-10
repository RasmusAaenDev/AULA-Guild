'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './icons';

const KEY = 'aula-banner-dismissed';

/**
 * «Du har ikke svaret på N kommende begivenheder» med lukkeknap. Afvisningen huskes for fanen (sessionStorage)
 * som det antal, der blev afvist; båndet kommer først tilbage, når antallet bliver større. Skjult, indtil
 * storage er læst, så et afvist bånd ikke blinker frem ved indlæsning.
 */
export function UnansweredBanner({ count }: { count: number }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let stored = 0;
    try {
      stored = Number(sessionStorage.getItem(KEY)) || 0;
    } catch {
      /* storage utilgængeligt: båndet vises bare */
    }
    setHidden(count <= stored);
  }, [count]);

  if (count <= 0 || hidden) return null;
  return (
    <div className="alert-banner" role="status">
      <Icon name="udraab" size={22} />
      <p>
        <Link href="/kalender">
          Du har ikke svaret på {count} {count === 1 ? 'kommende begivenhed' : 'kommende begivenheder'}
        </Link>
      </p>
      <button
        type="button"
        className="banner-close"
        aria-label="Luk meddelelsen"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(KEY, String(count));
          } catch {
            /* ignorer */
          }
        }}
      >
        <Icon name="luk" size={18} />
      </button>
    </div>
  );
}
