// Rene hjælpere til karakterskifteren i topbjælken (ingen React, let at teste).

/** Faste nøgler; hver har en CSS-variabel `--cls-<nøgle>` i app/globals.css. */
export const classKeys = [
  'death-knight', 'demon-hunter', 'druid', 'evoker', 'hunter', 'mage', 'monk',
  'paladin', 'priest', 'rogue', 'shaman', 'warlock', 'warrior',
] as const;
export type ClassKey = (typeof classKeys)[number] | 'ukendt';

export function classKey(className: string): ClassKey {
  const k = className.trim().toLowerCase().replace(/\s+/g, '-');
  return (classKeys as readonly string[]).includes(k) ? (k as ClassKey) : 'ukendt';
}

export function switcherLabel(fullName: string, isPrimary: boolean): string {
  return isPrimary ? `${fullName} (primær karakter)` : `Skift primær karakter til ${fullName}`;
}

/** Fast alfabetisk rækkefølge på fuldt navn, så knapperne ikke hopper, når den primære skifter. */
export function sortForSwitcher<T extends { id: number; fullName: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName, 'da') || a.id - b.id);
}
