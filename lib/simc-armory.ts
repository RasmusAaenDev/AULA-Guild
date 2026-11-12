// Bygger en simc-profil ud fra det armory viser (Blizzards profil-API), så man kan simulere uden at indsætte tekst.
// Ren funktion: resultatet SKAL bestå validateSimcInput (lib/simc-input.ts), som appen ellers bruger på indsat tekst.

import type { SimProfile } from '@/lib/blizzard/types';
import { CLASS_KEYS, MAX_NAME_LEN, MAX_VALUE_LEN } from '@/lib/simc-input';
import { encodeTalents, talentWarning } from '@/lib/simc-talents';

/** Blizzards pladstyper (equipment.slot.type) -> simc-nøgler. SHIRT og TABARD er med vilje udeladt (påvirker ikke DPS). */
export const ARMORY_SLOTS: Readonly<Record<string, string>> = {
  HEAD: 'head', NECK: 'neck', SHOULDER: 'shoulders', BACK: 'back', CHEST: 'chest', WRIST: 'wrist', HANDS: 'hands',
  WAIST: 'waist', LEGS: 'legs', FEET: 'feet', FINGER_1: 'finger1', FINGER_2: 'finger2', TRINKET_1: 'trinket1',
  TRINKET_2: 'trinket2', MAIN_HAND: 'main_hand', OFF_HAND: 'off_hand', RANGED: 'ranged',
};

/** Lowercase, apostrof fjernes, resten uden bogstaver/tal bliver til «_» («Mag'har Orc» -> «maghar_orc»). */
function token(s: string): string {
  return s.normalize('NFKD').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Racer simc kender med en alliance-/horde-variant; Blizzards navn har ingen fraktion, så profilens fraktion afgør. */
const FACTION_RACES = new Set(['dracthyr', 'earthen', 'haranir', 'harronir', 'pandaren', 'skyborne']);

/**
 * Race-token til simc. Forever har racer med andre navne end simc (fx «High Order Skyborne»); en ukendt race får simc til
 * at afbryde profilen uden brugbar fejl, så skyborne-varianter og fraktionsdelte racer mappes via fraktionen.
 * Alt andet: lowercase med «_» — og er det ukendt for simc, afviser workeren profilen.
 */
export function raceToken(race: string, faction: SimProfile['faction'] = null): string {
  let t = token(race);
  if (t === '') return 'unknown';
  if (t.includes('skyborne')) t = 'skyborne';
  if (t === 'harronir') t = 'haranir';
  if (FACTION_RACES.has(t)) return `${t}_${faction ?? 'alliance'}`;
  return t;
}

export function classToken(className: string): string {
  return token(className);
}

/** Navn til spillerlinjen: kun bogstaver, mellemrum, apostrof, punktum og bindestreg (workerens regler), højst 40 tegn. */
export function cleanPlayerName(name: string): string {
  const t = name.normalize('NFC').replace(/[^\p{L} '.\-]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const cut = [...t].slice(0, MAX_NAME_LEN).join('').trim();
  return cut === '' ? 'Karakter' : cut;
}

/**
 * Profilen til simc plus beskeder til brugeren (fx talenter der ikke kunne oversættes).
 * Talenterne skrives som `talents=` (simcs loadout-streng, se lib/simc-talents.ts); `spec=unknown` er nødvendig,
 * for uden spec afviser simc strengen, og i Forever giver enhver spec-tekst klassens eneste spec.
 */
export function buildSimProfile(profile: SimProfile): { input: string; warnings: string[] } {
  const cls = classToken(profile.className);
  const lines = [
    `${cls}="${cleanPlayerName(profile.name)}"`,
    `level=${profile.level}`,
    `race=${raceToken(profile.race, profile.faction)}`,
    'region=eu',
    'server=forever',
    'spec=unknown',
  ];
  const warnings: string[] = [];
  if (profile.talents.length > 0) {
    // Et ukendt talent-id når aldrig simc: det udelades her (simc ville ellers indlæse forkerte talenter eller stoppe).
    const t = encodeTalents(cls, profile.talents);
    if (t.used.length > 0 && t.talents !== null && t.talents.length <= MAX_VALUE_LEN) {
      lines.push(`talents=${t.talents}`);
      const w = talentWarning(t.dropped.length);
      if (w) warnings.push(w);
    } else {
      const w = talentWarning(profile.talents.length);
      if (w) warnings.push(w);
    }
  }
  const seen = new Set<string>();
  for (const e of profile.equipment) {
    const key = ARMORY_SLOTS[e.slot];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(`${key}=,id=${e.id}`);
  }
  return { input: lines.join('\n'), warnings };
}

export function buildSimInput(profile: SimProfile): string {
  return buildSimProfile(profile).input;
}

export const isSimClass = (className: string): boolean => CLASS_KEYS.has(classToken(className));
