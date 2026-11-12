'use server';

import { revalidatePath } from 'next/cache';
import { cooldownMessage, createRefreshGate, refreshMessage, type RefreshState } from '@/lib/refresh';
import { runSync } from '@/lib/services';
import { requireUser } from '@/lib/session';

const gate = createRefreshGate();

export async function refreshArmoryAction(_prev: RefreshState): Promise<RefreshState> {
  await requireUser();
  const taken = gate.take(Date.now());
  if (!taken.ok) return cooldownMessage(taken.waitSeconds);
  let result;
  try {
    result = await runSync();
  } catch {
    return { error: 'Opdateringen mislykkedes. Prøv igen om lidt.' };
  }
  revalidatePath('/kontakter');
  revalidatePath('/');
  return refreshMessage(result);
}
