'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './icons';

const KEY = 'aula-banner-dismissed';

/** «Du har ikke svaret på N kommende begivenheder» med lukkeknap; afvisningen huskes for fanen (sessionStorage) og gælder det viste antal. */
export function UnansweredBanner({ count }: { count: number }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === String(count)) setDismissed(true);
    } catch {
      /* storage utilgængeligt: båndet vises bare */
    }
  }, [count]);

  if (count <= 0 || dismissed) return null;
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
          setDismissed(true);
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
