'use server';

import { eq } from 'drizzle-orm';
import { createSendLimiter, submitChatMessage } from '@/lib/chat-send';
import { listMyCharacters } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getChat, isChatConfigured } from '@/lib/services';
import { requireMember } from '@/lib/session';

export type FormState = { error?: string; sent?: boolean };

const limiter = createSendLimiter({ max: 5, windowMs: 60_000, minGapMs: 2000 });

export async function sendChatMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const configured = isChatConfigured();
  let characterName: string | null = null;
  if (configured) {
    const db = getDb();
    const [user] = await db.select({ active: users.activeCharacterId }).from(users).where(eq(users.id, member.userId));
    if (user?.active != null) {
      const mine = await listMyCharacters(db, member.userId);
      characterName = mine.find((c) => c.id === user.active)?.fullName ?? null;
    }
  }
  const message = formData.get('message');
  const result = await submitChatMessage(
    { userId: member.userId, configured, chat: getChat(), characterName, limiter, now: Date.now() },
    message,
    formData.get('channelId'),
  );
  return result.error ? { error: result.error } : { sent: true };
}
