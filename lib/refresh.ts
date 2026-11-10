// Manuel «opdater fra armory»: spærring mod misbrug og dansk statusbesked. Ren logik, så den kan testes.

import type { SyncResult } from '@/lib/sync';

export const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

export type RefreshState = { error?: string; message?: string };

/** Fælles spærring: højst én manuel opdatering pr. REFRESH_COOLDOWN_MS (uanset hvem), da armory har en kaldgrænse. */
export function createRefreshGate(cooldownMs = REFRESH_COOLDOWN_MS) {
  let last = -Infinity;
  return {
    /** Registrerer og tillader, eller afviser med antal sekunder til næste mulighed. */
    take(now: number): { ok: true } | { ok: false; waitSeconds: number } {
      if (now - last < cooldownMs && now >= last) return { ok: false, waitSeconds: Math.ceil((cooldownMs - (now - last)) / 1000) };
      last = now;
      return { ok: true };
    },
  };
}

export function refreshMessage(r: SyncResult): RefreshState {
  if (r.skipped) return { error: 'Armory kunne ikke nås lige nu. Prøv igen om lidt.' };
  const n = `${r.updated} ${r.updated === 1 ? 'karakter' : 'karakterer'}`;
  return r.failed > 0
    ? { message: `Opdaterede ${n}. ${r.failed} kunne ikke hentes og beholder deres gamle data.` }
    : { message: `Opdaterede ${n} fra armory.` };
}

export function cooldownMessage(waitSeconds: number): RefreshState {
  return { error: `Armory er opdateret for nylig. Vent ${waitSeconds} sekunder, og prøv igen.` };
}
