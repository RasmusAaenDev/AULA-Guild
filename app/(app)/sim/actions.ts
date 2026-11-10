'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { isSimConfigured, kickSimQueue } from '@/lib/services';
import { requireMember } from '@/lib/session';
import { createSimLimiter, deleteMySim, enqueueSim } from '@/lib/sims';
import type { FormState } from '../chat/actions';

const limiter = createSimLimiter();

export async function enqueueSimAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  if (!isSimConfigured()) return { error: 'Simulation er ikke sat op.' };
  const r = await enqueueSim(getDb(), { userId: member.userId, limiter, now: Date.now() }, formData.get('input'));
  if (!r.ok) return { error: r.error };
  kickSimQueue();
  revalidatePath('/sim');
  return { sent: true };
}

export async function deleteSimAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const r = await deleteMySim(getDb(), member.userId, formData.get('simId'));
  if (!r.ok) return { error: r.error };
  revalidatePath('/sim');
  return {};
}
