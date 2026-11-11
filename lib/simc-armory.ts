// Bygger en simc-profil ud fra det armory viser (Blizzards profil-API), så man kan simulere uden at indsætte tekst.
// Ren funktion: resultatet SKAL bestå validateSimcInput (lib/simc-input.ts), som appen ellers bruger på indsat tekst.

import type { SimProfile } from '@/lib/blizzard/types';
import { CLASS_KEYS, MAX_NAME_LEN, MAX_VALUE_LEN } from '@/lib/simc-input';

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

export function buildSimInput(profile: SimProfile): string {
  const lines = [
    `${classToken(profile.className)}="${cleanPlayerName(profile.name)}"`,
    `level=${profile.level}`,
    `race=${raceToken(profile.race, profile.faction)}`,
    'region=eu',
    'server=forever',
    'spec=unknown',
  ];
  // Værdien må højst være MAX_VALUE_LEN tegn; ekstra talenter droppes hellere end at hele profilen afvises.
  let talents = '';
  for (const t of profile.talents) {
    const next = `${talents === '' ? '' : '/'}${t.id}:${t.rank}`;
    if (talents.length + next.length > MAX_VALUE_LEN) break;
    talents += next;
  }
  if (talents !== '') lines.push(`legacy_talents=${talents}`);
  const seen = new Set<string>();
  for (const e of profile.equipment) {
    const key = ARMORY_SLOTS[e.slot];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(`${key}=,id=${e.id}`);
  }
  return lines.join('\n');
}

export const isSimClass = (className: string): boolean => CLASS_KEYS.has(classToken(className));
