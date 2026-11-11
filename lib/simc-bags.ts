// Udtræk af genstande fra «### Gear from Bags» i SimC-addonens tekst. Ren funktion uden I/O.
// Reglerne for slot, id og label er en kopi af simc-worker/profilesets.mjs (workeren validerer igen).

export type BagItem = { slot: string; id: number; label: string };

export const MAX_BAG_ITEMS = 40;
export const MAX_ITEM_ID = 9_999_999;
export const MAX_LABEL_LEN = 60;

/** Slots der påvirker DPS (shirt/tabard/ammo/thrown/relic er udeladt med vilje). */
export const BAG_SLOTS: ReadonlySet<string> = new Set([
  'head', 'neck', 'shoulders', 'back', 'chest', 'wrist', 'hands', 'waist', 'legs', 'feet',
  'finger1', 'finger2', 'trinket1', 'trinket2', 'main_hand', 'off_hand', 'ranged',
]);

export type BagParse = {
  items: BagItem[];
  /** Genstande i sektionen som ikke blev brugt (ukendt slot/id, allerede udstyret, dubletter, over grænsen). */
  ignored: number;
  /** Heraf udeladt alene fordi der er flere end MAX_BAG_ITEMS. */
  truncated: number;
};

/** Fjerner alle tegn workeren ikke tillader (bogstaver, tal, mellemrum og ( ) ' - . ,), og afkorter. */
export function cleanLabel(raw: string): string {
  const s = raw.replace(/[^\p{L}\p{N} ()'\-.,]/gu, '').replace(/ {2,}/g, ' ').trim();
  return [...s].slice(0, MAX_LABEL_LEN).join('').trim();
}

const ITEM_RE = /^([a-z][a-z0-9_]*)=[^,]*,(?:[^#]*?,)?id=(\d+)(?:,|\s|$)/;
const NAME_RE = /^(.*?)\s*\(\d+\)\s*$/;

/** Slot og id på en profil-/taskelinje som «hands=,id=3308,bonus_id=1». */
function parseItemLine(line: string): { slot: string; id: number } | null {
  const m = ITEM_RE.exec(line);
  return m ? { slot: m[1], id: Number(m[2]) } : null;
}

export function parseBagItems(text: unknown): BagParse {
  const empty: BagParse = { items: [], ignored: 0, truncated: 0 };
  if (typeof text !== 'string') return empty;
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());

  // Udstyret = ikke-kommentar-linjer i selve profilen.
  const equipped = new Set<string>();
  for (const l of lines) {
    if (l === '' || l.startsWith('#')) continue;
    const it = parseItemLine(l);
    if (it) equipped.add(`${it.slot}:${it.id}`);
  }

  const items: BagItem[] = [];
  const seen = new Set<string>();
  let ignored = 0;
  let truncated = 0;
  let inSection = false;
  let name: string | null = null;
  for (const l of lines) {
    if (/^###/.test(l)) {
      inSection = /^###\s*Gear from Bags\s*$/i.test(l);
      name = null;
      continue;
    }
    if (!inSection || !l.startsWith('#')) continue;
    const body = l.replace(/^#+\s*/, '');
    if (body === '') {
      name = null;
      continue;
    }
    const it = parseItemLine(body);
    if (!it && /^[a-z][a-z0-9_]*=/.test(body)) {
      ignored++; // slot=…-linje uden brugbart id
      name = null;
      continue;
    }
    if (!it) {
      const m = NAME_RE.exec(body);
      name = m ? m[1] : body;
      continue;
    }
    const label = cleanLabel(name ?? '') || `Genstand ${it.id}`;
    name = null;
    const key = `${it.slot}:${it.id}`;
    if (!BAG_SLOTS.has(it.slot) || it.id < 1 || it.id > MAX_ITEM_ID || equipped.has(key) || seen.has(key)) {
      ignored++;
      continue;
    }
    seen.add(key);
    if (items.length >= MAX_BAG_ITEMS) {
      ignored++;
      truncated++;
      continue;
    }
    items.push({ slot: it.slot, id: it.id, label });
  }
  return { items, ignored, truncated };
}

/** Defensiv validering af gemte/indsendte bagItems (samme regler som workeren). Ugyldige poster droppes. */
export function sanitizeBagItems(raw: unknown): BagItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BagItem[] = [];
  for (const r of raw) {
    if (out.length >= MAX_BAG_ITEMS) break;
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.slot !== 'string' || !BAG_SLOTS.has(o.slot)) continue;
    if (typeof o.id !== 'number' || !Number.isInteger(o.id) || o.id < 1 || o.id > MAX_ITEM_ID) continue;
    const label = typeof o.label === 'string' ? cleanLabel(o.label) : '';
    out.push({ slot: o.slot, id: o.id, label: label || `Genstand ${o.id}` });
  }
  return out;
}
