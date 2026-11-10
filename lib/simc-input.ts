// Appens egen validering af SimC-tekst fra WoW-addonet, FØR noget lægges i kø.
// Reglerne er en kopi af simc-worker/sanitize.mjs (hvidliste og værdiregler) og holdes i sync af tests/simc-input.test.ts.
// Kun det rensede input sendes videre til workeren; kommentarer og tomme linjer fjernes.

export const MAX_INPUT_BYTES = 32 * 1024;
export const MAX_VALUE_LEN = 512;
export const MAX_NAME_LEN = 40;
const ECHO_MAX = 40;

export const CLASS_KEYS: ReadonlySet<string> = new Set([
  'druid', 'hunter', 'mage', 'paladin', 'priest', 'rogue', 'shaman', 'warlock', 'warrior',
]);

/** Klasser SimC kender, men som ikke findes i WoW Forever (bruges kun til en bedre fejlbesked). */
const OTHER_CLASS_KEYS: ReadonlySet<string> = new Set(['deathknight', 'death_knight', 'demonhunter', 'demon_hunter', 'evoker', 'monk']);

export const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'level', 'race', 'region', 'server', 'role', 'professions', 'spec', 'talents', 'legacy_talents',
  'glyphs', 'position', 'shirt', 'tabard', 'head', 'neck', 'shoulders', 'back', 'chest', 'wrist',
  'hands', 'waist', 'legs', 'feet', 'finger1', 'finger2', 'trinket1', 'trinket2', 'main_hand',
  'off_hand', 'ranged', 'ammo', 'thrown', 'relic', 'bag1', 'bag2', 'bag3', 'bag4',
]);

const NAME_RE = /^[\p{L} '.\-]+$/u;
// Alle kontroltegn undtagen \n (tab ændres til mellemrum før kontrollen, så workeren aldrig ser tab).
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** Højst 40 tegn af indholdet, med kontroltegn erstattet, så en fejlbesked aldrig ekkoer et langt input. */
function snip(s: string): string {
  const chars = [...s];
  const t = chars.length > ECHO_MAX ? chars.slice(0, ECHO_MAX).join('') + '…' : s;
  return t.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, '?');
}

export type SimcInputResult = { ok: true; input: string; className: string } | { ok: false; error: string };

export function validateSimcInput(raw: unknown): SimcInputResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Indsæt din SimC-tekst først.' };
  const text = raw.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').trim();
  if (text === '') return { ok: false, error: 'Indsæt din SimC-tekst først.' };
  if (new TextEncoder().encode(text).length > MAX_INPUT_BYTES) {
    return { ok: false, error: 'Teksten er for lang (højst 32 KB).' };
  }
  const out: string[] = [];
  let className: string | null = null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const line = lines[i];
    if (CONTROL_RE.test(line)) return { ok: false, error: `Linje ${n}: indeholder kontroltegn, som ikke er tilladt.` };
    const t = line.trim();
    if (t === '' || t.startsWith('#')) continue;
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
      if (className) return { ok: false, error: `Linje ${n}: der må kun være én spillerlinje i teksten.` };
      className = key;
      out.push(`${key}="${m[1]}"`);
      continue;
    }
    if (OTHER_CLASS_KEYS.has(key)) return { ok: false, error: 'Klassen støttes ikke i WoW Forever-simulatoren.' };
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Linje ${n}: nøglen «${snip(key)}» er ikke tilladt.` };
    }
    if (/:\/\/|https?:|[\\"`$;|&<>]|\.\.\//i.test(value)) {
      return { ok: false, error: `Linje ${n}: værdien til «${snip(key)}» indeholder tegn, der ikke er tilladt.` };
    }
    out.push(`${key}=${value}`);
  }
  if (!className) return { ok: false, error: 'Teksten skal indeholde præcis én spillerlinje (fx hunter="Navn").' };
  return { ok: true, input: out.join('\n'), className };
}
