// Egne chat-kanaler, kun i vores database. Ren DB-logik uden Next, så den kan testes.
// Autorisation håndhæves her, ikke kun i UI'et.

import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { characters, chatChannels, chatMessages, users } from '@/lib/db/schema';
import { createSendLimiter, validateMessage, type SendLimiter } from '@/lib/chat-send';
import { fullName } from '@/lib/names';

export const MAX_ACTIVE_CHANNELS = 30;
export const MAX_NEW_CHANNELS_PER_HOUR = 3;
export const NAME_MIN = 2;
export const NAME_MAX = 30;
export const MESSAGE_PAGE = 50;

export type Actor = { userId: number; isOfficer: boolean };
export type Reason = 'invalid' | 'not_found' | 'forbidden' | 'duplicate' | 'limit' | 'rate_limited' | 'no_character';
export type Fail = { ok: false; reason: Reason; error: string };
export type Result<T> = ({ ok: true } & T) | Fail;

const fail = (reason: Reason, error: string): Fail => ({ ok: false, reason, error });

export type SiteChannel = { id: number; name: string; createdBy: number | null };
export type SiteMessage = { id: number; userId: number | null; characterId: number | null; authorName: string; content: string; createdAt: string };
/** Med karakterens nuværende slug (til armory-link), eller null hvis beskeden ikke (længere) har en karakter. */
export type ListedMessage = SiteMessage & { characterSlug: string | null };

const MAX_INT = 2_147_483_647;

/** Id'er skal være positive heltal inden for Postgres' integer; tal som tekst accepteres. Alt andet giver null. */
export function parseId(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^[0-9]{1,10}$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_INT ? n : null;
}

const NAME_RE = /^[\p{L}\p{N} _-]+$/u;

/** Trimmer, klapper mellemrum sammen og validerer kanalnavnet. */
export function validateChannelName(raw: unknown): { ok: true; name: string } | Fail {
  if (typeof raw !== 'string') return fail('invalid', 'Skriv et navn til kanalen.');
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  const len = [...name].length;
  if (len < NAME_MIN || len > NAME_MAX) return fail('invalid', `Navnet skal være ${NAME_MIN}–${NAME_MAX} tegn.`);
  if (!NAME_RE.test(name)) return fail('invalid', 'Navnet må kun indeholde bogstaver, tal, mellemrum, bindestreg og understreg.');
  return { ok: true, name };
}

function isUniqueViolation(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && typeof x === 'object' && i < 4; i++) {
    if ((x as { code?: unknown }).code === '23505') return true;
    x = (x as { cause?: unknown }).cause;
  }
  return false;
}

export function createChannelLimiter() {
  return createSendLimiter({ max: MAX_NEW_CHANNELS_PER_HOUR, windowMs: 3_600_000, minGapMs: 0 });
}
export function createMessageLimiter() {
  return createSendLimiter({ max: 5, windowMs: 60_000, minGapMs: 2000 });
}

export async function createChannel(
  db: Db,
  deps: { userId: number; limiter: SendLimiter; now: number },
  rawName: unknown,
): Promise<Result<{ channel: SiteChannel }>> {
  const valid = validateChannelName(rawName);
  if (!valid.ok) return valid;
  const limit = deps.limiter.take(deps.userId, deps.now);
  if (!limit.ok) return fail('rate_limited', 'Du har oprettet for mange kanaler. Prøv igen om lidt.');
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7301)`); // serialiserer kanalgrænsen
      const [{ n }] = await tx.select({ n: count() }).from(chatChannels).where(isNull(chatChannels.deletedAt));
      if (n >= MAX_ACTIVE_CHANNELS) return fail('limit', `Der kan højst være ${MAX_ACTIVE_CHANNELS} egne kanaler. Slet en, før du opretter en ny.`);
      const [row] = await tx
        .insert(chatChannels)
        .values({ name: valid.name, createdBy: deps.userId })
        .returning({ id: chatChannels.id, name: chatChannels.name, createdBy: chatChannels.createdBy });
      return { ok: true as const, channel: row };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail('duplicate', 'Der findes allerede en kanal med det navn.');
    throw e;
  }
}

export async function listChannels(db: Db): Promise<SiteChannel[]> {
  return db
    .select({ id: chatChannels.id, name: chatChannels.name, createdBy: chatChannels.createdBy })
    .from(chatChannels)
    .where(isNull(chatChannels.deletedAt))
    .orderBy(asc(sql`lower(${chatChannels.name})`), asc(chatChannels.id));
}

/** Kun aktive kanaler; ugyldigt id eller slettet kanal giver null. */
export async function getChannel(db: Db, id: unknown): Promise<SiteChannel | null> {
  const cid = parseId(id);
  if (cid === null) return null;
  const [row] = await db
    .select({ id: chatChannels.id, name: chatChannels.name, createdBy: chatChannels.createdBy })
    .from(chatChannels)
    .where(and(eq(chatChannels.id, cid), isNull(chatChannels.deletedAt)));
  return row ?? null;
}

export function canDeleteChannel(actor: Actor, channel: { createdBy: number | null }): boolean {
  return actor.isOfficer || (channel.createdBy !== null && channel.createdBy === actor.userId);
}
export function canDeleteMessage(actor: Actor, message: { userId: number | null }): boolean {
  return actor.isOfficer || (message.userId !== null && message.userId === actor.userId);
}

export async function deleteChannel(db: Db, actor: Actor, id: unknown): Promise<Result<object>> {
  const channel = await getChannel(db, id);
  if (!channel) return fail('not_found', 'Kanalen findes ikke.');
  if (!canDeleteChannel(actor, channel)) return fail('forbidden', 'Du kan kun slette kanaler, du selv har oprettet.');
  await db
    .update(chatChannels)
    .set({ deletedAt: new Date() })
    .where(and(eq(chatChannels.id, channel.id), isNull(chatChannels.deletedAt)));
  return { ok: true };
}

async function activeCharacter(db: Db, userId: number): Promise<{ id: number; name: string } | null> {
  const [row] = await db
    .select({ id: characters.id, name: characters.name, surname: characters.surname, slug: characters.slug })
    .from(users)
    .innerJoin(characters, and(eq(characters.id, users.activeCharacterId), eq(characters.userId, users.id)))
    .where(eq(users.id, userId));
  return row ? { id: row.id, name: fullName(row) } : null;
}

export async function postMessage(
  db: Db,
  deps: { userId: number; limiter: SendLimiter; now: number },
  channelId: unknown,
  raw: unknown,
): Promise<Result<{ message: SiteMessage }>> {
  const cid = parseId(channelId);
  if (cid === null) return fail('not_found', 'Kanalen findes ikke.');
  const valid = validateMessage(raw);
  if (!valid.ok) return fail('invalid', valid.error);
  const character = await activeCharacter(db, deps.userId);
  if (!character) return fail('no_character', 'Vælg en karakter først.');
  if (!(await getChannel(db, cid))) return fail('not_found', 'Kanalen findes ikke.');
  const limit = deps.limiter.take(deps.userId, deps.now);
  if (!limit.ok) return fail('rate_limited', limit.error);
  // Indsættes kun hvis kanalen stadig er aktiv (lukker kapløbet med en samtidig sletning).
  const rows = await db.execute(sql`
    insert into chat_messages (channel_id, user_id, character_id, author_name, content)
    select ${cid}, ${deps.userId}, ${character.id}, ${character.name}, ${valid.text}
    where exists (select 1 from chat_channels where id = ${cid} and deleted_at is null)
    returning id, user_id, character_id, author_name, content, created_at`);
  const r = rows[0] as { id: number; user_id: number | null; character_id: number | null; author_name: string; content: string; created_at: Date | string } | undefined;
  if (!r) return fail('not_found', 'Kanalen findes ikke.');
  return {
    ok: true,
    message: {
      id: r.id, userId: r.user_id, characterId: r.character_id, authorName: r.author_name, content: r.content,
      createdAt: new Date(r.created_at).toISOString(),
    },
  };
}

/** De seneste `limit` beskeder, ældste først. Slettet eller ukendt kanal giver null. */
export async function listMessages(db: Db, channelId: unknown, opts: { limit?: number } = {}): Promise<ListedMessage[] | null> {
  const channel = await getChannel(db, channelId);
  if (!channel) return null;
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? MESSAGE_PAGE), 1), 200);
  const rows = await db
    .select({
      id: chatMessages.id, userId: chatMessages.userId, characterId: chatMessages.characterId,
      authorName: chatMessages.authorName, content: chatMessages.content, createdAt: chatMessages.createdAt,
      characterSlug: characters.slug,
    })
    .from(chatMessages)
    .leftJoin(characters, eq(characters.id, chatMessages.characterId))
    .where(and(eq(chatMessages.channelId, channel.id), isNull(chatMessages.deletedAt)))
    .orderBy(desc(chatMessages.id))
    .limit(limit);
  return rows.reverse().map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function deleteMessage(db: Db, actor: Actor, id: unknown): Promise<Result<object>> {
  const mid = parseId(id);
  if (mid === null) return fail('not_found', 'Beskeden findes ikke.');
  const [row] = await db
    .select({ id: chatMessages.id, userId: chatMessages.userId })
    .from(chatMessages)
    .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
    .where(and(eq(chatMessages.id, mid), isNull(chatMessages.deletedAt), isNull(chatChannels.deletedAt)));
  if (!row) return fail('not_found', 'Beskeden findes ikke.');
  if (!canDeleteMessage(actor, row)) return fail('forbidden', 'Du kan kun slette dine egne beskeder.');
  await db.update(chatMessages).set({ deletedAt: new Date() }).where(and(eq(chatMessages.id, mid), isNull(chatMessages.deletedAt)));
  return { ok: true };
}
