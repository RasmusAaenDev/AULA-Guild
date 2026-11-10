import { auth } from '@/auth';
import { chatResponse } from '@/lib/chat-http';
import { getChat } from '@/lib/services';

export const dynamic = 'force-dynamic';

/** Seneste beskeder fra den valgte Discord-kanal. Kun medlemmer; tokenet forlader aldrig serveren. */
export async function GET(): Promise<Response> {
  const session = await auth();
  return chatResponse(session?.user, getChat());
}
