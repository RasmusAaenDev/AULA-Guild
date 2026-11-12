import { auth } from '@/auth';
import { chatResponse } from '@/lib/chat-http';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Seneste beskeder fra en egen kanal (?kanal=egen-<id>). For alle indloggede. */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  return chatResponse(session?.user, new URL(req.url).searchParams.get('kanal'), getDb());
}
