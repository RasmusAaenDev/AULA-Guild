import { auth } from '@/auth';
import { chatResponse } from '@/lib/chat-http';
import { getChat } from '@/lib/services';

export const dynamic = 'force-dynamic';

/** Seneste beskeder fra den valgte Discord-kanal (?kanal=<id>). Kun medlemmer; tokenet forlader aldrig serveren. */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  return chatResponse(session?.user, getChat(), new URL(req.url).searchParams.get('kanal'));
}
