'use client';

import { useEffect } from 'react';

/**
 * Sætter `data-hydrated` på <html>, når siden er klar i browseren. Før da er formularernes knapper låst i CSS:
 * et for tidligt klik ville ellers blive sendt som almindelig GET og bare genindlæse siden uden at gøre noget.
 */
export function HydrationMark() {
  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', '');
  }, []);
  return null;
}
