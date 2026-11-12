// Aulas rettelser oven på simc (patches/): hvilke klasser bygget fik en rettelse, og hvad det betyder for et resultat.
import { readFile } from 'node:fs/promises';
import { CLASS_KEYS } from './sanitize.mjs';

export const PATCH_STATUSES = new Set(['applied', 'dropped-upstream']);
export const MODEL_AULA = 'aula-rettelse';
export const MODEL_WARNING = 'Grov model: klassen er implementeret af Aula, ikke af SimulationCraft. Tallene er vejledende.';
/** Klasser hvor rettelsen er en rettelse oven på SimulationCraft's egen grundmodel (ikke en hel model fra Aula). */
export const FIX_ON_UPSTREAM = new Set(['druid', 'priest']);
export const MODEL_WARNING_FIX = 'Grov model: SimulationCraft\'s grundmodel med Aulas rettelser. Tallene er vejledende.';

/** «<klasse> <status>» pr. linje (skrevet af patches/apply.sh) -> [{ class, status }]. Ukendte linjer ignoreres. */
export function parsePatchesApplied(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const m = /^([a-z]+) ([a-z-]+)$/.exec(line.trim());
    if (m && CLASS_KEYS.has(m[1]) && PATCH_STATUSES.has(m[2]) && !out.some((p) => p.class === m[1])) {
      out.push({ class: m[1], status: m[2] });
    }
  }
  return out;
}

/** Læser filen ved opstart; mangler den (fx ældre image eller test), er der ingen rettelser. */
export async function readPatchesApplied(file) {
  try {
    return parsePatchesApplied(await readFile(file, 'utf8'));
  } catch {
    return [];
  }
}

/** { model, warning } når spillerens klasse kører på Aulas rettelse, ellers null. */
export function modelInfo(patches, className) {
  return patches.some((p) => p.class === className && p.status === 'applied')
    ? { model: MODEL_AULA, warning: FIX_ON_UPSTREAM.has(className) ? MODEL_WARNING_FIX : MODEL_WARNING }
    : null;
}
