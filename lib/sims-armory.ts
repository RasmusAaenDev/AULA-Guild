// Armory-indgangen til sim-køen: brugerens egen karakter -> profil fra Blizzard -> simc-tekst -> samme kø som indsat tekst.
// Ren DB-/klientlogik uden Next, så den kan testes; ejerskab tjekkes her, ikke kun i UI'et.

import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters } from '@/lib/db/schema';
import { BlizzardError, type BlizzardClient } from '@/lib/blizzard/types';
import type { SendLimiter } from '@/lib/chat-send';
import { parseId } from '@/lib/site-chat';
import { buildSimInput, isSimClass } from '@/lib/simc-armory';
import { FIGHT_STYLES, enqueueSim, isFightStyle, type SimEnqueueOptions, type SimFail } from '@/lib/sims';

export const ARMORY_NOT_FOUND = 'Karakteren blev ikke fundet i armory. Tjek at den findes på WoW Forever.';
export const ARMORY_UNAVAILABLE = 'Armory er ikke tilgængelig lige nu. Prøv igen om lidt.';

export function armoryErrorMessage(e: unknown): string {
  return e instanceof BlizzardError && e.kind === 'not_found' ? ARMORY_NOT_FOUND : ARMORY_UNAVAILABLE;
}

export async function enqueueArmorySim(
  db: Db,
  deps: { userId: number; limiter: SendLimiter; now: number; blizzard: BlizzardClient },
  rawCharacterId: unknown,
  rawOptions: Pick<SimEnqueueOptions, 'fightStyles'>,
): Promise<ReturnType<typeof enqueueSim>> {
  const fail = (reason: SimFail['reason'], error: string): SimFail => ({ ok: false, reason, error });
  const id = parseId(rawCharacterId);
  if (id === null) return fail('not_found', 'Vælg en af dine karakterer.');
  // Ejerskab: kun en karakter knyttet til brugeren selv. Sluggen kommer altid fra databasen, aldrig fra klienten.
  const [ch] = await db.select({ id: characters.id, slug: characters.slug }).from(characters).where(and(eq(characters.id, id), eq(characters.userId, deps.userId)));
  if (!ch) return fail('not_found', 'Vælg en af dine karakterer.');
  // Kampstile tjekkes før opslaget hos Blizzard, så en tom/ugyldig anmodning ikke koster et API-kald.
  const fs = rawOptions.fightStyles;
  if (!Array.isArray(fs) || fs.length === 0) return fail('invalid', 'Vælg mindst én kampstil.');
  if (fs.length > FIGHT_STYLES.length || !fs.every(isFightStyle) || new Set(fs).size !== fs.length) return fail('invalid', 'Ugyldig kampstil.');
  let profile;
  try {
    profile = await deps.blizzard.getSimProfile(ch.slug);
  } catch (e) {
    return fail('invalid', armoryErrorMessage(e));
  }
  if (!isSimClass(profile.className)) return fail('invalid', 'Klassen støttes ikke i WoW Forever-simulatoren.');
  return enqueueSim(
    db,
    { userId: deps.userId, limiter: deps.limiter, now: deps.now, characterId: ch.id, source: 'armory' },
    buildSimInput(profile),
    { fightStyles: fs, optimizeBags: false },
  );
}
