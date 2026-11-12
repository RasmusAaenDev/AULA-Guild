// Armory-indgangen til sim-køen: karakter -> profil fra Blizzard -> simc-tekst -> samme kø som indsat tekst.
// To veje: (1) brugerens egen registrerede karakter (id, fra knapperne ved karakteren; ejerskab tjekkes her), og
// (2) et fritekstnavn på HVILKEN SOM HELST karakter på WoW Forever (Skolehjem-formularen). Ren DB-/klientlogik uden Next.

import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters } from '@/lib/db/schema';
import { BlizzardError, type BlizzardClient } from '@/lib/blizzard/types';
import type { SendLimiter } from '@/lib/chat-send';
import { addCharacterMessage } from '@/lib/messages';
import { fullName } from '@/lib/names';
import { parseId } from '@/lib/site-chat';
import { buildSimProfile, isSimClass } from '@/lib/simc-armory';
import { nameToSlug, normalizeName } from '@/lib/slug';
import { FIGHT_STYLES, enqueueSim, isFightStyle, type FightStyle, type SimEnqueueOptions, type SimFail, type SimView } from '@/lib/sims';

export const ARMORY_NOT_FOUND = 'Karakteren blev ikke fundet i armory. Tjek at den findes på WoW Forever. Helt nye karakterer på et meget lavt level vises ikke i armory endnu.';
export const ARMORY_UNAVAILABLE = 'Armory er ikke tilgængelig lige nu. Prøv igen om lidt.';
export const UNSUPPORTED_CLASS = 'Klassen støttes ikke i WoW Forever-simulatoren.';

export function armoryErrorMessage(e: unknown): string {
  return e instanceof BlizzardError && e.kind === 'not_found' ? ARMORY_NOT_FOUND : ARMORY_UNAVAILABLE;
}

type Deps = { userId: number; limiter: SendLimiter; now: number; blizzard: BlizzardClient };
type Result = { ok: true; id: number; bags: SimView['bags']; notices: string[] } | SimFail;
const fail = (reason: SimFail['reason'], error: string): SimFail => ({ ok: false, reason, error });

/** Kampstile tjekkes før opslaget hos Blizzard, så en tom/ugyldig anmodning ikke koster et API-kald. */
function parseFightStyles(raw: unknown): FightStyle[] | SimFail {
  if (!Array.isArray(raw) || raw.length === 0) return fail('invalid', 'Vælg mindst én kampstil.');
  if (raw.length > FIGHT_STYLES.length || !raw.every(isFightStyle) || new Set(raw).size !== raw.length) return fail('invalid', 'Ugyldig kampstil.');
  return raw;
}

/**
 * Fælles del: profil fra Blizzard (sluggen kommer aldrig rå fra klienten, men fra databasen eller fra nameToSlug),
 * simc-tekst, og i kø gennem de samme grænser som indsat tekst. `subjectName` er karakterens fulde visningsnavn og
 * gemmes på jobbet, så kortet kan vise det også for karakterer, brugeren ikke har registreret.
 */
async function enqueueProfile(
  db: Db, deps: Deps, target: { slug: string; characterId: number | null; typedName: string | null }, fightStyles: FightStyle[],
): Promise<Result> {
  let profile;
  try {
    profile = await deps.blizzard.getSimProfile(target.slug);
  } catch (e) {
    return fail('invalid', armoryErrorMessage(e));
  }
  if (!isSimClass(profile.className)) return fail('invalid', UNSUPPORTED_CLASS);
  const subjectName = fullName({ name: profile.name, slug: target.slug });
  const { input, warnings } = buildSimProfile(profile);
  const r = await enqueueSim(
    db,
    { userId: deps.userId, limiter: deps.limiter, now: deps.now, characterId: target.characterId ?? undefined, source: 'armory', notices: warnings, subjectName },
    input,
    { fightStyles, optimizeBags: false },
  );
  return r.ok ? { ...r, notices: warnings } : r;
}

/** Knapperne ved en karakter: kun brugerens egen registrerede karakter (id). */
export async function enqueueArmorySim(db: Db, deps: Deps, rawCharacterId: unknown, rawOptions: Pick<SimEnqueueOptions, 'fightStyles'>): Promise<Result> {
  const id = parseId(rawCharacterId);
  if (id === null) return fail('not_found', 'Vælg en af dine karakterer.');
  // Ejerskab: kun en karakter knyttet til brugeren selv.
  const [ch] = await db.select({ id: characters.id, slug: characters.slug }).from(characters).where(and(eq(characters.id, id), eq(characters.userId, deps.userId)));
  if (!ch) return fail('not_found', 'Vælg en af dine karakterer.');
  const fs = parseFightStyles(rawOptions.fightStyles);
  if (!Array.isArray(fs)) return fs;
  return enqueueProfile(db, deps, { slug: ch.slug, characterId: ch.id, typedName: null }, fs);
}

/**
 * Skolehjem-formularen: et fritekstnavn (fornavn + efternavn) på en vilkårlig karakter på WoW Forever. Samme regler og
 * fejlbeskeder som «Tilføj karakter». Jobbet knyttes kun til en karakter (characterId), hvis navnet er en af brugerens
 * egne registrerede karakterer (match på slug); ellers null.
 */
export async function enqueueArmorySimByName(db: Db, deps: Deps, rawName: unknown, rawOptions: Pick<SimEnqueueOptions, 'fightStyles'>): Promise<Result> {
  const typed = typeof rawName === 'string' ? rawName : '';
  if (normalizeName(typed).split(' ').filter(Boolean).length < 2) return fail('invalid', addCharacterMessage('invalid_name'));
  const slug = nameToSlug(typed);
  if (!slug) return fail('invalid', addCharacterMessage('invalid_characters'));
  const fs = parseFightStyles(rawOptions.fightStyles);
  if (!Array.isArray(fs)) return fs;
  const [own] = await db.select({ id: characters.id }).from(characters).where(and(eq(characters.slug, slug), eq(characters.userId, deps.userId)));
  return enqueueProfile(db, deps, { slug, characterId: own?.id ?? null, typedName: typed }, fs);
}
