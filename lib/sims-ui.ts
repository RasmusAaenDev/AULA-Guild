import type { SimStatus } from '@/lib/db/schema';
import type { FightStyle, SimItemResult, SimResult, SimSource, SimStyleResult } from '@/lib/sims';

export function simStatusLabel(status: SimStatus): string {
  switch (status) {
    case 'queued': return 'Venter i kø';
    case 'running': return 'Kører';
    case 'done': return 'Færdig';
    default: return 'Fejlede';
  }
}

/** Trin i forløbet Kø → Kører → Færdig (fejlet tæller som sidste trin, så bjælken er fuld). */
export const STATUS_STEPS = ['Kø', 'Kører', 'Færdig'] as const;
export function statusStep(status: SimStatus): number {
  switch (status) {
    case 'queued': return 1;
    case 'running': return 2;
    default: return 3;
  }
}
export const isActiveStatus = (status: SimStatus): boolean => status === 'queued' || status === 'running';

const int = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
export const formatInt = (n: number): string => int.format(n);

/** «DPS ≈ 1.234 ± 12» (da-DK, kun heltal). */
export function simDpsLabel(r: { dps: SimResult['dps'] }): string {
  const base = `DPS ≈ ${int.format(r.dps.mean)}`;
  return r.dps.meanStdDev !== null ? `${base} ± ${int.format(r.dps.meanStdDev)}` : base;
}

export const NO_ROTATION_TEXT =
  'Simulatoren til WoW Forever har endnu ikke en rotation for denne klasse og spec. Den virker automatisk, når den kommer.';

/** Ingen brugbar DPS (null, 0 eller mangler) og ingen egentlig fejl: simulatoren kender ikke klassens/specens rotation. */
export const hasNoDps = (s: Pick<SimStyleResult, 'dps' | 'error'>): boolean => !s.error && (!s.dps || !(s.dps.mean > 0));

/** For hver kampstil uden DPS: den pæne forklaring (i stedet for «DPS ≈ 0» eller workerens rå advarsel). */
export function noRotationMessages(styles: Pick<SimStyleResult, 'fightStyle' | 'dps' | 'error'>[]): { fightStyle: string; text: string }[] {
  return styles.filter(hasNoDps).map((s) => ({ fightStyle: s.fightStyle, text: NO_ROTATION_TEXT }));
}

/** Workerens egen «DPS er 0 eller mangler …»-advarsel erstattes af forklaringen ovenfor. */
export const visibleWarnings = (warnings: string[]): string[] => warnings.filter((w) => !/^DPS er 0 eller mangler/.test(w));

export const SOURCE_LABELS: Record<SimSource, string> = { armory: 'Armory', simc: 'SimC-tekst' };

export const FIGHT_STYLE_LABELS: Record<string, string> = {
  Patchwerk: 'Patchwerk (enkelt mål)',
  DungeonSlice: 'Dungeon Slice (flere mål)',
};
export const fightStyleLabel = (s: string): string => FIGHT_STYLE_LABELS[s] ?? s;

/** Kort navn og forklaring hver for sig, til kort og badges. */
const FIGHT_STYLE_SHORT: Record<string, { name: string; hint: string }> = {
  Patchwerk: { name: 'Patchwerk', hint: 'enkelt mål' },
  DungeonSlice: { name: 'Dungeon Slice', hint: 'flere mål' },
};
export const fightStyleName = (s: string): string => FIGHT_STYLE_SHORT[s]?.name ?? s;
export const fightStyleHint = (s: string): string => FIGHT_STYLE_SHORT[s]?.hint ?? '';

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

/** Én række pr. genstand fra taskerne med resultatet i hver kampstil, så de kan sammenlignes side om side. */
export type GearRow = {
  key: string;
  index: number;
  slot: string;
  label: string;
  /** Resultat pr. kampstil (mangler hvis genstanden ikke var med i den kampstil). */
  cells: Partial<Record<FightStyle, SimItemResult>>;
  /** Bedste procentvise ændring på tværs af kampstile; null hvis ingen kunne simuleres. */
  best: number | null;
};

/** Fletter kampstilenes genstande til rækker, sorteret efter bedste ændring (størst først); fejlede sidst. */
export function mergeGearRows(styles: Pick<SimStyleResult, 'fightStyle' | 'items'>[]): GearRow[] {
  const map = new Map<string, GearRow>();
  for (const s of styles) {
    for (const i of s.items) {
      const key = `${i.index}-${i.slot}-${i.id}`;
      const row = map.get(key) ?? { key, index: i.index, slot: i.slot, label: i.label, cells: {}, best: null };
      row.cells[s.fightStyle] = i;
      if (itemVerdict(i) !== 'error' && i.deltaPercent !== null) row.best = row.best === null ? i.deltaPercent : Math.max(row.best, i.deltaPercent);
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.best === null || b.best === null) return a.best === null ? (b.best === null ? a.index - b.index : 1) : -1;
    return b.best - a.best || a.index - b.index;
  });
}

/** Rækker, der er en opgradering i mindst én kampstil (højst TOP_UPGRADES). */
export const upgradeRows = (rows: GearRow[]): GearRow[] =>
  rows.filter((r) => Object.values(r.cells).some((c) => c && itemVerdict(c) === 'upgrade')).slice(0, TOP_UPGRADES);

/** Rækker der kunne simuleres i mindst én kampstil. */
export const comparableRows = (rows: GearRow[]): GearRow[] => rows.filter((r) => r.best !== null);

/** Første bogstav stort («shaman» → «Shaman»). */
export const capitalize = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** «Shaman · level 41» eller «Mage · Frost · level 20» — spec vises kun, når den ikke blot gentager klassen. */
export function playerDetail(p: { className: string | null; spec: string | null; level: number | null }): string {
  const parts: string[] = [];
  if (p.className) parts.push(capitalize(p.className));
  if (p.spec && p.spec.toLowerCase() !== (p.className ?? '').toLowerCase()) parts.push(capitalize(p.spec));
  if (p.level !== null) parts.push(`level ${p.level}`);
  return parts.join(' · ');
}

export type SimSubject = { name: string | null; className: string | null; spec: string | null; level: number | null };

/**
 * Hvem simulationen handler om: resultatets spiller når jobbet er færdigt, ellers karakteren fra armory-valget;
 * for indsat SimC-tekst uden resultat kendes navnet ikke endnu.
 */
export function simSubject(
  sim: { result: { player: SimSubject } | null; characterId: number | null },
  characters: readonly { id: number; name: string; className: string; spec: string | null }[],
): SimSubject {
  if (sim.result) return sim.result.player;
  const c = sim.characterId !== null ? characters.find((x) => x.id === sim.characterId) : undefined;
  return c ? { name: c.name, className: c.className, spec: c.spec, level: null } : { name: null, className: null, spec: null, level: null };
}

/** Initialer til den klassefarvede cirkel: første bogstav i navnet (eller «?»). */
export const subjectInitial = (name: string | null): string => (name ? [...name][0].toUpperCase() : '?');

/** «12 s», «1 min 10 s». */
export function durationText(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m} min` : `${m} min ${rest} s`;
}

export type SimProgress = { fraction: number; text: string };

const BASELINE_RE = /^Generating Baseline: (\d+)\/(\d+) \[[^\]]*\] (\d+)\/(\d+)/;
const PROFILESET_RE = /^Profilesets \([^)]*\): (\d+)\/(\d+) \[/;
const STYLE_RE = /^== Kampstil: (\w+) ==/;

/**
 * Læser fremdrift ud af simc-loggen (de «n/N»-linjer SimulationCraft skriver). Pr. kampstil tæller grundkørslen som
 * ét trin og hver testet genstand som ét; på tværs af kampstile vægtes de ens. null hvis loggen intet fortæller endnu.
 */
export function logProgress(log: string | null, styleCount = 1): SimProgress | null {
  if (!log) return null;
  const styles = Math.max(1, Math.trunc(styleCount));
  let styleIndex = -1;
  let style = '';
  let within = 0;
  let text: string | null = null;
  for (const line of log.split('\n')) {
    const st = STYLE_RE.exec(line);
    if (st) { styleIndex++; style = st[1]; within = 0; text = `${fightStyleName(style)}: starter`; continue; }
    const b = BASELINE_RE.exec(line);
    if (b) {
      const steps = Math.max(1, Number(b[2]));
      const iter = Number(b[3]);
      const iters = Math.max(1, Number(b[4]));
      within = Math.min(1, iter / iters) / steps;
      text = `${fightStyleName(style)}: grundkørsel ${formatInt(iter)}/${formatInt(iters)}`;
      continue;
    }
    const p = PROFILESET_RE.exec(line);
    if (p) {
      const k = Number(p[1]);
      const n = Math.max(1, Number(p[2]));
      within = Math.min(1, (1 + k) / (n + 1));
      text = `${fightStyleName(style)}: genstand ${k} af ${n}`;
      continue;
    }
    if (/^Generating reports/.test(line) && style) { within = 1; text = `${fightStyleName(style)}: laver rapport`; }
  }
  if (text === null) return /Venter i kø/.test(log) ? { fraction: 0, text: 'Venter på simulatoren' } : null;
  const fraction = Math.min(1, Math.max(0, (Math.max(0, styleIndex) + within) / styles));
  return { fraction, text };
}

export type PreviousDps = { mean: number; createdAt: string; deltaPercent: number };

/**
 * Forrige færdige simulation af samme karakter i samme kampstil (ældre end `index` i den nyeste-først-liste), så kortet
 * kan vise «+2,4 % siden sidst». null hvis der ikke er en at sammenligne med, eller en af dem mangler DPS.
 */
export function previousDps(
  sims: readonly { status: SimStatus; createdAt: string; result: { player: { name: string | null }; styles: Pick<SimStyleResult, 'fightStyle' | 'dps'>[] } | null }[],
  index: number,
  fightStyle: FightStyle,
): PreviousDps | null {
  const cur = sims[index];
  const name = cur?.result?.player.name;
  const curDps = cur?.result?.styles.find((s) => s.fightStyle === fightStyle)?.dps;
  if (!name || !curDps || !(curDps.mean > 0)) return null;
  for (let i = index + 1; i < sims.length; i++) {
    const s = sims[i];
    if (s.status !== 'done' || !s.result || s.result.player.name !== name) continue;
    const dps = s.result.styles.find((x) => x.fightStyle === fightStyle)?.dps;
    if (!dps || !(dps.mean > 0)) continue;
    return { mean: dps.mean, createdAt: s.createdAt, deltaPercent: ((curDps.mean - dps.mean) / dps.mean) * 100 };
  }
  return null;
}

/** Navne til filteret «Vis: Alle · Rød · Magi», i rækkefølge efter første forekomst; kun når der er mindst to. */
export function subjectFilterNames(subjects: readonly SimSubject[]): string[] {
  const names = [...new Set(subjects.map((s) => s.name).filter((n): n is string => n !== null))];
  return names.length >= 2 ? names : [];
}

/** Læser `?karakter=` fra URL'en; kun navne der findes i listen accepteres. */
export function parseSubjectFilter(raw: string | string[] | undefined, names: readonly string[]): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && names.includes(v) ? v : null;
}
