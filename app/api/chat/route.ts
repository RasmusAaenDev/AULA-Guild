import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getChat } from '@/lib/services';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Seneste beskeder fra den valgte Discord-kanal. Kun medlemmer; tokenet forlader aldrig serveren. */
export async function GET(): Promise<Response> {
  const session = await auth();
  const user = session?.user;
  if (!user?.isMember || !user.id) {
    return NextResponse.json({ error: 'Du skal være logget ind.' }, { status: 401, headers: NO_STORE });
  }
  const chat = getChat();
  if (!chat) {
    return NextResponse.json({ error: 'Chatten er ikke sat op.' }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(await chat.getMessages(), { headers: NO_STORE });
}
