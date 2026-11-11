import { useEffect, useState } from 'react';

/** Falsk indtil siden er hydreret i browseren. Før da ville en formular blive sendt som almindelig GET og bare genindlæse siden. */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
