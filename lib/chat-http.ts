import { NextResponse } from 'next/server';
import type { ChatClient } from '@/lib/chat';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Svarlogikken bag GET /api/chat; ruten klarer kun at hente session og klient. */
export async function chatResponse(
  user: { isMember?: boolean; id?: string } | undefined,
  chat: ChatClient | null,
): Promise<Response> {
  if (!user?.isMember || !user.id) {
    return NextResponse.json({ error: 'Du skal være logget ind.' }, { status: 401, headers: NO_STORE });
  }
  if (!chat) {
    return NextResponse.json({ error: 'Chatten er ikke sat op.' }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(await chat.getMessages(), { headers: NO_STORE });
}
