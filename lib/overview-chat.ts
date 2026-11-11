// Seneste chatbeskeder til Overblik. Må aldrig blokere eller vælte siden: tidsgrænse og fejl giver bare færre/ingen beskeder.

import type { ChatClient, ChatMessage } from '@/lib/chat';
import { resolveAuthors } from '@/lib/chat-authors';
import { SITE_PREFIX } from '@/lib/chat-http';
import type { Db } from '@/lib/db';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { chatChannels, chatMessages } from '@/lib/db/schema';

export type ChatItem = {
  id: string;
  source: 'discord' | 'site';
  /** Værdien til `/chat?kanal=…`: Discord-kanalens id eller `egen-<id>`. */
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

type Candidate = { source: 'discord' | 'site'; channelId: string; channelName: string; msg: ChatMessage; at: Date };

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}

function newest(cands: Candidate[], n: number): Candidate[] {
  return [...cands].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, n);
}

// Blizzards/Discords egen systemtekst i WoW-linkede kanaler er støj i Overblik.
const SYSTEM_NOISE = /has not yet linked their (discord|battle\.net)/i;

async function discordCandidates(chat: ChatClient, since: number, now: number): Promise<Candidate[]> {
  const list = await chat.listChannels();
  const perChannel = await Promise.all(
    list.channels.map(async (c) => {
      const r = await chat.getMessages(c.id);
      if (r.error) return [];
      const cands: Candidate[] = [];
      for (const msg of r.messages) {
        const t = Date.parse(msg.timestamp);
        if (Number.isNaN(t) || t < since || t > now + 60_000 || msg.content.trim() === '' || SYSTEM_NOISE.test(msg.content)) continue;
        cands.push({ source: 'discord', channelId: c.id, channelName: c.name, msg, at: new Date(t) });
      }
      return newest(cands, CHAT_PER_CHANNEL);
    }),
  );
  return perChannel.flat();
}

async function siteCandidates(db: Db, since: number, now: number): Promise<Candidate[]> {
  // Én samlet forespørgsel (de nyeste beskeder i aktive kanaler inden for vinduet) i stedet for én pr. kanal.
  const rows = await db
    .select({ id: chatMessages.id, channelId: chatMessages.channelId, channelName: chatChannels.name, authorName: chatMessages.authorName, content: chatMessages.content, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
    .where(and(isNull(chatMessages.deletedAt), isNull(chatChannels.deletedAt), gt(chatMessages.createdAt, new Date(since))))
    .orderBy(desc(chatMessages.id))
    .limit(60);
  const byChannel = new Map<number, Candidate[]>();
  for (const m of rows) {
    const t = m.createdAt.getTime();
    if (t > now + 60_000 || m.content.trim() === '') continue;
    const msg: ChatMessage = { id: String(m.id), author: m.authorName, authorId: null, content: m.content, mentions: [], timestamp: m.createdAt.toISOString(), bot: false };
    const list = byChannel.get(m.channelId) ?? [];
    list.push({ source: 'site', channelId: `${SITE_PREFIX}${m.channelId}`, channelName: m.channelName, msg, at: new Date(t) });
    byChannel.set(m.channelId, list);
  }
  return [...byChannel.values()].flatMap((cands) => newest(cands, CHAT_PER_CHANNEL));
}

/** Højst 6 beskeder fra de seneste 7 dage (højst 2 pr. kanal), nyeste først. Fejl og tidsoverskridelse giver tom liste. */
export async function recentChatItems(
  deps: { chat: ChatClient | null; db: Db; timeoutMs?: number },
  now: Date,
): Promise<ChatItem[]> {
  const since = now.getTime() - CHAT_WINDOW_DAYS * 86_400_000;
  const run = async (): Promise<ChatItem[]> => {
    const [discord, site] = await Promise.all([
      deps.chat ? discordCandidates(deps.chat, since, now.getTime()).catch(() => [] as Candidate[]) : Promise.resolve([] as Candidate[]),
      siteCandidates(deps.db, since, now.getTime()).catch(() => [] as Candidate[]),
    ]);
    const picked = newest([...discord, ...site], CHAT_MAX_ITEMS);
    if (picked.length === 0) return [];
    const resolved = await resolveAuthors(deps.db, picked.map((c) => c.msg));
    const items: ChatItem[] = [];
    picked.forEach((c, i) => {
      const r = resolved[i];
      const content = clipChatText(r.content);
      if (content === '') return;
      items.push({
        id: `${c.source}-${c.channelId}-${c.msg.id}`,
        source: c.source,
        channelId: c.channelId,
        channelName: c.channelName,
        author: c.source === 'site' ? c.msg.author : r.author,
        armoryUrl: c.source === 'site' ? null : r.armoryUrl,
        content,
        at: c.at,
      });
    });
    return items;
  };
  return withTimeout(run(), deps.timeoutMs ?? CHAT_TIMEOUT_MS, []);
}
