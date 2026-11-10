'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Opdaterer siden hvert 3. sekund, mens noget venter eller kører; stopper af sig selv og ryddes ved unmount. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
