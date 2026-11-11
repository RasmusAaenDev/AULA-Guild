// Link til karakterens side i WoW Forever-armory (Blizzard). Formatet er bekræftet mod den rigtige side:
// en eksisterende karakter svarer 200 («<Navn> - Character»), en ukendt svarer 500.
const ARMORY_BASE = 'https://worldofwarcraft.blizzard.com/en-gb/forever/eu/armory/character';

/** Karakter-slug (fx `magi-far`) → armory-adresse, eller null uden gyldig slug. */
export function armoryUrl(slug: string | null | undefined): string | null {
  const s = typeof slug === 'string' ? slug.trim() : '';
  if (s === '' || s.length > 80 || /[\s/\\?#]/.test(s)) return null;
  return `${ARMORY_BASE}/${encodeURIComponent(s)}`;
}
