// Saneringsmodul: hvidlister simc-profilen linje for linje, så ingen nøgler
// der kan læse/skrive filer eller netværk nogensinde når simc.

export const MAX_INPUT_BYTES = 32 * 1024;
export const MAX_VALUE_LEN = 512;
export const MAX_NAME_LEN = 40;

export const CLASS_KEYS = new Set([
  'druid', 'hunter', 'mage', 'paladin', 'priest', 'rogue', 'shaman', 'warlock', 'warrior',
]);

// Slot-/felt-navne der forekommer i addon-eksporterne (src/profiles) + de øvrige udstyrsslots.
export const ALLOWED_KEYS = new Set([
  'level', 'race', 'region', 'server', 'role', 'professions', 'spec', 'talents', 'legacy_talents',
  'glyphs', 'position', 'shirt', 'tabard', 'head', 'neck', 'shoulders', 'back', 'chest', 'wrist',
  'hands', 'waist', 'legs', 'feet', 'finger1', 'finger2', 'trinket1', 'trinket2', 'main_hand',
  'off_hand', 'ranged', 'ammo', 'thrown', 'relic', 'bag1', 'bag2', 'bag3', 'bag4',
]);

const NAME_RE = /^[\p{L} '.\-]+$/u;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;

function snip(s) {
  const t = s.length > 40 ? s.slice(0, 40) + '…' : s;
  return t.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');
}

/**
 * @returns {{ok:true, lines:string[], className:string}|{ok:false, error:string}}
 */
export function sanitizeProfile(input) {
  if (typeof input !== 'string') return { ok: false, error: 'Profilen skal være tekst.' };
  if (Buffer.byteLength(input, 'utf8') > MAX_INPUT_BYTES) {
    return { ok: false, error: 'Profilen er for lang (højst 32 KB).' };
  }
  const out = [];
  let className = null;
  const rawLines = input.split(/\r\n|\n|\r/);
  for (let i = 0; i < rawLines.length; i++) {
    const n = i + 1;
    const line = rawLines[i];
    if (CONTROL_RE.test(line)) {
      return { ok: false, error: `Linje ${n}: indeholder kontroltegn, som ikke er tilladt.` };
    }
    const t = line.trim();
    if (t === '' || t.startsWith('#')) continue; // kommentarer sendes ikke videre
    const eq = t.indexOf('=');
    if (eq <= 0) {
      return { ok: false, error: `Linje ${n}: ugyldigt format (forventede nøgle=værdi): «${snip(t)}».` };
    }
    const key = t.slice(0, eq);
    const value = t.slice(eq + 1);
    if (value.length > MAX_VALUE_LEN) {
      return { ok: false, error: `Linje ${n}: værdien er for lang (højst ${MAX_VALUE_LEN} tegn).` };
    }
    if (CLASS_KEYS.has(key)) {
      const m = /^"([^"]*)"$/.exec(value);
      if (!m || m[1].length === 0 || m[1].length > MAX_NAME_LEN || !NAME_RE.test(m[1])) {
        return {
          ok: false,
          error: `Linje ${n}: spillerens navn skal stå i anførselstegn og kun bestå af bogstaver, mellemrum, bindestreg, apostrof og punktum (højst ${MAX_NAME_LEN} tegn).`,
        };
      }
      if (className) return { ok: false, error: `Linje ${n}: der må kun være én spillerlinje i profilen.` };
      className = key;
      out.push(`${key}="${m[1]}"`);
      continue;
    }
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Linje ${n}: nøglen «${snip(key)}» er ikke tilladt.` };
    }
    // Forsvar i dybden: ingen URL'er, stier eller anførselstegn/backslash i værdier.
    if (/:\/\/|https?:|[\\"`$;|&<>]|\.\.\//i.test(value)) {
      return { ok: false, error: `Linje ${n}: værdien til «${snip(key)}» indeholder tegn der ikke er tilladt.` };
    }
    out.push(`${key}=${value}`);
  }
  if (!className) return { ok: false, error: 'Profilen skal indeholde præcis én spillerlinje (fx hunter="Navn").' };
  return { ok: true, lines: out, className };
}
