// Gør Discord-forfattere om til WoW-karakternavne på serveren, pr. request (ingen cache). Klienten får kun visningsnavne,
// karakter-slug og armory-link: aldrig Discord-id'er.

import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, users } from '@/lib/db/schema';
import { armoryUrl } from '@/lib/armory';
import type { ChatMessage, ChatResult } from '@/lib/chat';
import { fullName } from '@/lib/names';

export type PublicMessage = {
  id: string;
  author: string;
  characterSlug: string | null;
  armoryUrl: string | null;
  content: string;
  timestamp: string;
  bot: boolean;
};
export type PublicChatResult = Omit<ChatResult, 'messages'> & { messages: PublicMessage[] };

// Præcis formatet fra buildContent i chat-send.ts: `**[Aula] <escapet navn>:** `.
const AULA_PREFIX = /^\*\*\[Aula\] ((?:\\[\s\S]|[^\\\n])+?):\*\* ?/;
const UNESCAPE = /\\([*_~`>|\\[\]])/g;

function parseAulaPrefix(content: string): { name: string; rest: string } | null {
  const m = AULA_PREFIX.exec(content);
  if (!m) return null;
  const name = m[1].replace(UNESCAPE, '$1').replace(/​/g, '').trim();
  return name === '' ? null : { name, rest: content.slice(m[0].length) };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type Known = { name: string; slug: string };

/** Slår alle forfattere, omtaler og [Aula]-navne op med to queries uanset antal beskeder. */
export async function resolveAuthors(db: Db, messages: ChatMessage[]): Promise<PublicMessage[]> {
  const aula = messages.map((m) => (m.bot ? parseAulaPrefix(m.content) : null));
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.authorId) ids.add(m.authorId);
    for (const x of m.mentions) ids.add(x.id);
  }
  const byDiscord = new Map<string, Known>();
  if (ids.size > 0) {
    const rows = await db
      .select({ discordId: users.discordId, name: characters.name, surname: characters.surname, slug: characters.slug })
      .from(users)
      .innerJoin(characters, sql`${characters.id} = ${users.activeCharacterId}`)
      .where(inArray(users.discordId, [...ids]));
    for (const r of rows) byDiscord.set(r.discordId, { name: fullName(r), slug: r.slug });
  }
  const byName = new Map<string, Known>();
  const wanted = [...new Set(aula.flatMap((a) => (a ? [a.name.toLowerCase()] : [])))];
  if (wanted.length > 0) {
    const rows = await db
      .select({ name: characters.name, surname: characters.surname, slug: characters.slug })
      .from(characters)
      .where(sql`lower(trim(${characters.name} || ' ' || coalesce(${characters.surname}, ''))) in (${sql.join(wanted.map((w) => sql`${w}`), sql`, `)})`)
      .orderBy(characters.id);
    for (const r of rows) {
      const full = fullName(r);
      const key = full.toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: full, slug: r.slug });
    }
  }

  return messages.map((m, i) => {
    let author = m.author;
    let slug: string | null = null;
    let content = m.content;
    const a = aula[i];
    if (a) {
      const known = byName.get(a.name.toLowerCase());
      author = known?.name ?? a.name;
      slug = known?.slug ?? null;
      content = a.rest;
    } else if (m.authorId) {
      const known = byDiscord.get(m.authorId);
      if (known) {
        author = known.name;
        slug = known.slug;
      }
    }
    const swaps = new Map<string, string>();
    for (const x of m.mentions) {
      const known = byDiscord.get(x.id);
      if (known) swaps.set(`@${x.name}`, `@${known.name}`);
    }
    if (swaps.size > 0) {
      const re = new RegExp([...swaps.keys()].sort((p, q) => q.length - p.length).map(escapeRe).join('|'), 'g');
      content = content.replace(re, (t) => swaps.get(t) ?? t);
    }
    return { id: m.id, author, characterSlug: slug, armoryUrl: slug ? armoryUrl(slug) : null, content, timestamp: m.timestamp, bot: m.bot };
  });
}

export async function resolveChatResult(db: Db, result: ChatResult): Promise<PublicChatResult> {
  return { ...result, messages: await resolveAuthors(db, result.messages) };
}

/** Sluggene på brugerens egne karakterer: bruges kun til at fremhæve brugerens egne beskeder i visningen. */
export async function ownCharacterSlugs(db: Db, userId: number): Promise<string[]> {
  const rows = await db.select({ slug: characters.slug }).from(characters).where(eq(characters.userId, userId));
  return rows.map((r) => r.slug);
}
