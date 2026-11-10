import { NextResponse } from 'next/server';
import type { ChatClient } from '@/lib/chat';
import { resolveChatResult } from '@/lib/chat-authors';
import type { Db } from '@/lib/db';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Svarlogikken bag GET /api/chat; ruten klarer kun at hente session og klient. */
export async function chatResponse(
  user: { isMember?: boolean; id?: string } | undefined,
  chat: ChatClient | null,
  channelId: string | null,
  db: Db,
): Promise<Response> {
  if (!user?.isMember || !user.id) {
    return NextResponse.json({ error: 'Du skal være logget ind.' }, { status: 401, headers: NO_STORE });
  }
  if (!chat) {
    return NextResponse.json({ error: 'Chatten er ikke sat op.' }, { status: 404, headers: NO_STORE });
  }
  if (!channelId) {
    return NextResponse.json({ error: 'Kanal mangler.' }, { status: 400, headers: NO_STORE });
  }
  return NextResponse.json(await resolveChatResult(db, await chat.getMessages(channelId)), { headers: NO_STORE });
}
