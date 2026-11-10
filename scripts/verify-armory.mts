import { createBlizzardClient } from '@/lib/blizzard/client';
import { nameToSlug } from '@/lib/slug';

const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;
const guildSlug = process.env.BLIZZARD_GUILD_SLUG ?? 'aula';
const guildId = Number(process.env.BLIZZARD_GUILD_ID ?? 304114);
if (!clientId || !clientSecret) throw new Error('Sæt BLIZZARD_CLIENT_ID og BLIZZARD_CLIENT_SECRET');

const blizzard = createBlizzardClient({ clientId, clientSecret });
const roster = await blizzard.getGuildRoster(guildSlug);
console.log(`Roster: ${roster.length} medlemmer`);

let bad = 0;
for (const m of roster) {
  try {
    const c = await blizzard.getCharacter(m.slug);
    const issues: string[] = [];
    if (c.blizzardId !== m.blizzardId) issues.push(`id ${c.blizzardId} ≠ roster ${m.blizzardId}`);
    if (c.guildId !== guildId) issues.push(`guildId ${c.guildId}`);
    if (c.spec === null) issues.push('spec mangler');
    if (c.itemLevel === null) issues.push('item level mangler');
    const typed = nameToSlug(m.name);
    const slugNote = typed !== m.slug ? ` [slug≠nameToSlug: ${typed}]` : '';
    console.log(`${issues.length ? 'AFVIGELSE' : 'ok       '} ${m.name} (${m.slug}) ${c.className} spec=${c.spec} ilvl=${c.itemLevel}${slugNote} ${issues.join('; ')}`);
    if (issues.length) bad++;
  } catch (e) {
    bad++;
    console.log(`FEJL      ${m.name} (${m.slug}): ${(e as { kind?: string }).kind ?? 'ukendt fejl'}`);
  }
}
console.log(bad === 0 ? 'Alle roster-medlemmer kan slås op på rosterens slug.' : `${bad} afvigelser. Se ovenfor.`);
process.exit(bad === 0 ? 0 : 1);
