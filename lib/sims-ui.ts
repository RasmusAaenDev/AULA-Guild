import type { SimStatus } from '@/lib/db/schema';
import type { SimItemResult, SimResult } from '@/lib/sims';

export function simStatusLabel(status: SimStatus): string {
  switch (status) {
    case 'queued': return 'Venter i kø';
    case 'running': return 'Kører';
    case 'done': return 'Færdig';
    default: return 'Fejlede';
  }
}

const int = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

/** «DPS ≈ 1.234 ± 12» (da-DK, kun heltal). */
export function simDpsLabel(r: { dps: SimResult['dps'] }): string {
  const base = `DPS ≈ ${int.format(r.dps.mean)}`;
  return r.dps.meanStdDev !== null ? `${base} ± ${int.format(r.dps.meanStdDev)}` : base;
}

export const FIGHT_STYLE_LABELS: Record<string, string> = {
  Patchwerk: 'Patchwerk (enkelt mål)',
  DungeonSlice: 'Dungeon Slice (flere mål)',
};
export const fightStyleLabel = (s: string): string => FIGHT_STYLE_LABELS[s] ?? s;

const SLOT_LABELS: Record<string, string> = {
  head: 'hoved', neck: 'hals', shoulders: 'skuldre', back: 'ryg', chest: 'bryst', wrist: 'håndled', hands: 'hænder',
  waist: 'talje', legs: 'ben', feet: 'fødder', finger1: 'ring 1', finger2: 'ring 2', trinket1: 'trinket 1',
  trinket2: 'trinket 2', main_hand: 'våben i hånd', off_hand: 'anden hånd', ranged: 'afstand',
};
export const slotLabel = (slot: string): string => SLOT_LABELS[slot] ?? slot;

/** Under denne grænse (i procentpoint) er en ændring inden for støjen. */
export const NOISE_PERCENT = 0.3;
export type ItemVerdict = 'upgrade' | 'downgrade' | 'neutral' | 'error';

export function itemVerdict(i: Pick<SimItemResult, 'deltaPercent' | 'error'>): ItemVerdict {
  if (i.error || i.deltaPercent === null) return 'error';
  if (Math.abs(i.deltaPercent) < NOISE_PERCENT) return 'neutral';
  return i.deltaPercent > 0 ? 'upgrade' : 'downgrade';
}

/** «+2,8 %», «-1,5 %», «0,0 %» (da-DK, én decimal). */
export function percentText(p: number): string {
  const t = Math.abs(p).toFixed(1).replace('.', ',');
  return `${p > 0 && t !== '0,0' ? '+' : p < 0 && t !== '0,0' ? '-' : ''}${t} %`;
}

export const VERDICT_TEXT: Record<Exclude<ItemVerdict, 'error'>, string> = {
  upgrade: 'opgradering', downgrade: 'nedgradering', neutral: 'ingen mærkbar forskel',
};

/** Deler genstande i rangerede (størst ændring først) og dem der ikke kunne simuleres. */
export function rankItems(items: SimItemResult[]): { ranked: SimItemResult[]; failed: SimItemResult[] } {
  const ok = items.filter((i) => itemVerdict(i) !== 'error');
  return {
    ranked: ok.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0) || a.index - b.index),
    failed: items.filter((i) => itemVerdict(i) === 'error'),
  };
}

export const TOP_UPGRADES = 10;
