import { NextResponse } from 'next/server';
import type { ChatClient } from '@/lib/chat';
import { resolveChatResult } from '@/lib/chat-authors';
import type { Db } from '@/lib/db';
import { canDeleteMessage, listMessages, parseId } from '@/lib/site-chat';

export const SITE_PREFIX = 'egen-';

/** `egen-7` → 7; alt andet (også Discord-id'er) → null. */
export function parseSiteChannel(v: unknown): number | null {
  return typeof v === 'string' && v.startsWith(SITE_PREFIX) ? parseId(v.slice(SITE_PREFIX.length)) : null;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Svarlogikken bag GET /api/chat; ruten klarer kun at hente session og klient. */
export async function chatResponse(
  user: { isMember?: boolean; id?: string | number; isOfficer?: boolean } | undefined,
  chat: ChatClient | null,
  channelId: string | null,
  db: Db,
): Promise<Response> {
  if (!user?.isMember || !user.id) {
    return NextResponse.json({ error: 'Du skal være logget ind.' }, { status: 401, headers: NO_STORE });
  }
  if (channelId?.startsWith(SITE_PREFIX)) {
    const cid = parseSiteChannel(channelId);
    const messages = cid === null ? null : await listMessages(db, cid, { limit: 50 });
    if (!messages) return NextResponse.json({ error: 'Kanalen findes ikke.' }, { status: 404, headers: NO_STORE });
    const actor = { userId: Number(user.id), isOfficer: user.isOfficer === true };
    return NextResponse.json(
      { messages: messages.map((m) => ({ id: m.id, author: m.authorName, content: m.content, timestamp: m.createdAt, canDelete: canDeleteMessage(actor, m) })) },
      { headers: NO_STORE },
    );
  }
  if (!chat) {
    return NextResponse.json({ error: 'Chatten er ikke sat op.' }, { status: 404, headers: NO_STORE });
  }
  if (!channelId) {
    return NextResponse.json({ error: 'Kanal mangler.' }, { status: 400, headers: NO_STORE });
  }
  return NextResponse.json(await resolveChatResult(db, await chat.getMessages(channelId)), { headers: NO_STORE });
}
