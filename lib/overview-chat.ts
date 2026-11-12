// Seneste beskeder fra egne kanaler til Overblik. Må aldrig blokere eller vælte siden: tidsgrænse og fejl giver bare færre/ingen beskeder.

import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { armoryUrl } from '@/lib/armory';
import { SITE_PREFIX } from '@/lib/chat-http';
import type { Db } from '@/lib/db';
import { characters, chatChannels, chatMessages } from '@/lib/db/schema';

export type ChatItem = {
  id: string;
  /** Værdien til `/chat?kanal=…`, altid `egen-<id>`. */
  channelId: string;
  channelName: string;
  author: string;
  armoryUrl: string | null;
  content: string;
  at: Date;
};

export const CHAT_MAX_ITEMS = 6;
export const CHAT_PER_CHANNEL = 2;
export const CHAT_WINDOW_DAYS = 7;
export const CHAT_MAX_CHARS = 280;
export const CHAT_TIMEOUT_MS = 1500;

export function chatItemHref(item: Pick<ChatItem, 'channelId'>): string {
  return `/chat?kanal=${encodeURIComponent(item.channelId)}`;
}

/** Gør tekst flad (mellemrum klappes sammen) og afkorter til 280 tegn med «…». */
export function clipChatText(text: string, limit = CHAT_MAX_CHARS): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length > limit ? `${chars.slice(0, limit).join('').trimEnd()}…` : flat;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}

const newestFirst = (a: ChatItem, b: ChatItem) => b.at.getTime() - a.at.getTime();

async function siteItems(db: Db, since: number, now: number): Promise<ChatItem[]> {
  // Én samlet forespørgsel (de nyeste beskeder i aktive kanaler inden for vinduet) i stedet for én pr. kanal.
  const rows = await db
    .select({
      id: chatMessages.id, channelId: chatMessages.channelId, channelName: chatChannels.name, authorName: chatMessages.authorName,
      content: chatMessages.content, createdAt: chatMessages.createdAt, slug: characters.slug,
    })
    .from(chatMessages)
    .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
    .leftJoin(characters, eq(characters.id, chatMessages.characterId))
    .where(and(isNull(chatMessages.deletedAt), isNull(chatChannels.deletedAt), gt(chatMessages.createdAt, new Date(since))))
    .orderBy(desc(chatMessages.id))
    .limit(60);
  const byChannel = new Map<number, ChatItem[]>();
  for (const m of rows) {
    const t = m.createdAt.getTime();
    if (t > now + 60_000) continue;
    const content = clipChatText(m.content);
    if (content === '') continue;
    const list = byChannel.get(m.channelId) ?? [];
    list.push({
      id: `${SITE_PREFIX}${m.channelId}-${m.id}`,
      channelId: `${SITE_PREFIX}${m.channelId}`,
      channelName: m.channelName,
      author: m.authorName,
      armoryUrl: armoryUrl(m.slug),
      content,
      at: new Date(t),
    });
    byChannel.set(m.channelId, list);
  }
  return [...byChannel.values()].flatMap((items) => items.sort(newestFirst).slice(0, CHAT_PER_CHANNEL));
}

/** Højst 6 beskeder fra de seneste 7 dage (højst 2 pr. kanal), nyeste først. Fejl og tidsoverskridelse giver tom liste. */
export async function recentChatItems(deps: { db: Db; timeoutMs?: number }, now: Date): Promise<ChatItem[]> {
  const since = now.getTime() - CHAT_WINDOW_DAYS * 86_400_000;
  const run = async (): Promise<ChatItem[]> =>
    (await siteItems(deps.db, since, now.getTime())).sort(newestFirst).slice(0, CHAT_MAX_ITEMS);
  return withTimeout(run(), deps.timeoutMs ?? CHAT_TIMEOUT_MS, []);
}
