// Ren logik til kampstile og gear-optimering via simc-profilesets.
// Workeren bygger selv alle profileset-linjer ud fra strukturerede felter;
// brugerens tekst (label) når aldrig simc og bruges kun i svaret.

export const FIGHT_STYLES = ['Patchwerk', 'DungeonSlice'];
export const DEFAULT_FIGHT_STYLES = ['Patchwerk'];
export const MAX_BAG_ITEMS = 40;
export const MAX_ITEM_ID = 9_999_999;
export const MAX_LABEL_LEN = 60;

// Slots der påvirker DPS (shirt/tabard/ammo/thrown/relic er udeladt med vilje).
export const BAG_SLOTS = new Set([
  'head', 'neck', 'shoulders', 'back', 'chest', 'wrist', 'hands', 'waist', 'legs', 'feet',
  'finger1', 'finger2', 'trinket1', 'trinket2', 'main_hand', 'off_hand', 'ranged',
]);
const PAIRS = { finger1: ['finger1', 'finger2'], finger2: ['finger1', 'finger2'], trinket1: ['trinket1', 'trinket2'], trinket2: ['trinket1', 'trinket2'] };

const LABEL_RE = /^[\p{L}\p{N} ()'\-.,]+$/u;

/**
 * Validerer fightStyles og bagItems fra request-bodyen.
 * @returns {{ok:true, fightStyles:string[], bagItems:{slot:string,id:number,label:string}[]}|{ok:false, error:string}}
 */
export function validateRunOptions(body) {
  let fightStyles = DEFAULT_FIGHT_STYLES;
  if (body.fightStyles !== undefined) {
    const fs = body.fightStyles;
    if (!Array.isArray(fs) || fs.length < 1 || fs.length > 2) {
      return { ok: false, error: 'fightStyles skal være en liste med 1 eller 2 kampstile.' };
    }
    for (const s of fs) {
      if (typeof s !== 'string' || !FIGHT_STYLES.includes(s)) {
        return { ok: false, error: `fightStyles: ukendt kampstil. Tilladt: ${FIGHT_STYLES.join(', ')}.` };
      }
    }
    if (new Set(fs).size !== fs.length) return { ok: false, error: 'fightStyles må ikke indeholde dubletter.' };
    fightStyles = [...fs];
  }
  const bagItems = [];
  if (body.bagItems !== undefined) {
    const b = body.bagItems;
    if (!Array.isArray(b)) return { ok: false, error: 'bagItems skal være en liste.' };
    if (b.length > MAX_BAG_ITEMS) return { ok: false, error: `bagItems må højst indeholde ${MAX_BAG_ITEMS} items.` };
    for (let i = 0; i < b.length; i++) {
      const it = b[i];
      if (!it || typeof it !== 'object' || Array.isArray(it)) {
        return { ok: false, error: `bagItems[${i}]: forventede et objekt.` };
      }
      if (typeof it.slot !== 'string' || !BAG_SLOTS.has(it.slot)) {
        return { ok: false, error: `bagItems[${i}]: ugyldig slot.` };
      }
      if (!Number.isInteger(it.id) || it.id < 1 || it.id > MAX_ITEM_ID) {
        return { ok: false, error: `bagItems[${i}]: id skal være et positivt heltal (højst ${MAX_ITEM_ID}).` };
      }
      if (typeof it.label !== 'string' || it.label.length < 1 || it.label.length > MAX_LABEL_LEN || !LABEL_RE.test(it.label)) {
        return { ok: false, error: `bagItems[${i}]: label skal være 1-${MAX_LABEL_LEN} tegn (bogstaver, tal, mellemrum og ( ) ' - . ,).` };
      }
      bagItems.push({ slot: it.slot, id: it.id, label: it.label });
    }
  }
  return { ok: true, fightStyles, bagItems };
}

/** Finder udstyrede item-id'er pr. slot i de sanerede profillinjer ("head=,id=123,..."). */
export function equippedFromLines(lines) {
  const eq = new Map();
  for (const l of lines) {
    const eqPos = l.indexOf('=');
    const slot = l.slice(0, eqPos);
    if (!BAG_SLOTS.has(slot)) continue;
    const m = /(?:^|,)id=(\d+)(?:,|$)/.exec(l.slice(eqPos + 1));
    if (m) eq.set(slot, Number(m[1]));
  }
  return eq;
}

/**
 * Bygger profileset-linjer ud fra validerede bagItems (rent, ingen I/O).
 * Navne: i<index> (finger/trinket: i<index>a og i<index>b = erstat slot 1 hhv. 2).
 * Indekser i `skip` udelades (items simc ikke kunne indlæse). Items der allerede er udstyret (samme slot+id; for par: i en af de to slots) springes over.
 * @returns {{lines:string[], entries:Map<string,{index:number,slot:string,id:number,label:string}>}}
 */
export function buildProfilesets(bagItems, equipped, setIterations, skip = new Set()) {
  const lines = [];
  const entries = new Map();
  const add = (name, index, slot, it) => {
    lines.push(`profileset.${name}+=${slot}=,id=${it.id}`);
    if (setIterations) lines.push(`profileset.${name}+=iterations=${setIterations}`);
    entries.set(name, { index, slot, id: it.id, label: it.label });
  };
  bagItems.forEach((it, index) => {
    if (skip.has(index)) return;
    const pair = PAIRS[it.slot];
    if (pair) {
      if (pair.some((s) => equipped.get(s) === it.id)) return;
      add(`i${index}a`, index, pair[0], it);
      add(`i${index}b`, index, pair[1], it);
    } else {
      if (equipped.get(it.slot) === it.id) return;
      add(`i${index}`, index, it.slot, it);
    }
  });
  return { lines, entries };
}

/** Profileset-iterationer: højst basis-iterationerne, men begrænset af et samlet budget. */
export const PROFILESET_ITER_FLOOR = 500;
export const PROFILESET_ITER_BUDGET = 60_000; // sum af iterationer over alle profilesets
export function profilesetIterations(iterations, nSets) {
  if (nSets <= 0) return iterations;
  return Math.min(iterations, Math.max(PROFILESET_ITER_FLOOR, Math.floor(PROFILESET_ITER_BUDGET / nSets)));
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round1 = (v) => Math.round(v * 10) / 10;

/** Henter profileset-resultater defensivt ud af json2: Map navn -> {mean, stdDev}. */
export function parseProfilesetResults(json) {
  const out = new Map();
  const results = json?.sim?.profilesets?.results;
  if (!Array.isArray(results)) return out;
  for (const r of results) {
    if (!r || typeof r.name !== 'string') continue;
    const mean = num(r.mean);
    if (mean === null || mean <= 0) continue;
    out.set(r.name, { mean, stdDev: num(r.stddev), meanStdDev: num(r.mean_stddev) });
  }
  return out;
}

/** Finder indekset på det profileset simc klagede over i stderr (bruges kun internt, aldrig til klienten). */
export function badProfilesetIndex(stderr) {
  const m = /Profileset 'i(\d{1,3})[ab]?'/.exec(stderr || '');
  return m ? Number(m[1]) : null;
}

/** Kobler resultater til items, beregner delta mod basis og sorterer (delta faldende, fejl sidst). */
export function buildItemResults(entries, results, baseMean) {
  const items = [];
  for (const [name, e] of entries) {
    const r = results.get(name);
    if (!r) {
      items.push({ index: e.index, slot: e.slot, id: e.id, label: e.label, dpsMean: null, dpsStdDev: null, delta: null, deltaPercent: null,
        error: 'Intet resultat fra simc for dette item (ukendt eller ikke understøttet item-id?).' });
      continue;
    }
    const delta = r.mean - baseMean;
    items.push({
      index: e.index, slot: e.slot, id: e.id, label: e.label,
      dpsMean: r.mean, dpsStdDev: r.stdDev, delta,
      deltaPercent: baseMean > 0 ? round1((delta / baseMean) * 100) : null,
    });
  }
  items.sort((a, b) => (a.delta === null) - (b.delta === null) || (b.delta ?? 0) - (a.delta ?? 0) || a.index - b.index);
  return items;
}
