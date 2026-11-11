'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { charactersDeps, isSimConfigured, kickSimQueue } from '@/lib/services';
import { requireMember } from '@/lib/session';
import { createSimLimiter, deleteMySim, enqueueSim } from '@/lib/sims';
import { enqueueArmorySim } from '@/lib/sims-armory';
import type { FormState } from '../chat/actions';

const limiter = createSimLimiter();

export async function enqueueSimAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  if (!isSimConfigured()) return { error: 'Simulation er ikke sat op.' };
  const fightStyles = [formData.get('patchwerk') === 'on' ? 'Patchwerk' : null, formData.get('dungeonSlice') === 'on' ? 'DungeonSlice' : null].filter((s) => s !== null);
  const optimizeBags = formData.get('optimizeBags') === 'on';
  const r = await enqueueSim(getDb(), { userId: member.userId, limiter, now: Date.now() }, formData.get('input'), { fightStyles, optimizeBags });
  if (!r.ok) return { error: r.error };
  kickSimQueue();
  revalidatePath('/sim');
  const notice = !r.bags.requested
    ? undefined
    : r.bags.found === 0
      ? 'Der blev ikke fundet nogen genstande i «Gear from Bags», så kun din nuværende udrustning simuleres.'
      : `${r.bags.found} genstande fra dine tasker bliver testet${r.bags.truncated > 0 ? ` (${r.bags.truncated} flere end grænsen på 40 blev ignoreret)` : ''}.`;
  return { sent: true, notice };
}

export async function enqueueArmorySimAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  if (!isSimConfigured()) return { error: 'Simulation er ikke sat op.' };
  const fightStyles = [formData.get('patchwerk') === 'on' ? 'Patchwerk' : null, formData.get('dungeonSlice') === 'on' ? 'DungeonSlice' : null].filter((s) => s !== null);
  const r = await enqueueArmorySim(getDb(), { userId: member.userId, limiter, now: Date.now(), blizzard: charactersDeps().blizzard }, formData.get('characterId'), { fightStyles });
  if (!r.ok) return { error: r.error };
  kickSimQueue();
  revalidatePath('/sim');
  return { sent: true, notice: 'Simulationen er sat i kø. Den bruger det udstyr, armory viser, uden talenter.' };
}

/** «Sim»-knapperne ved en karakter: én kampstil, direkte fra armory; ved succes videre til Skolehjem, hvor loggen kan følges. */
export async function quickSimAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  if (!isSimConfigured()) return { error: 'Simulation er ikke sat op.' };
  const style = formData.get('style');
  const r = await enqueueArmorySim(getDb(), { userId: member.userId, limiter, now: Date.now(), blizzard: charactersDeps().blizzard }, formData.get('characterId'), { fightStyles: typeof style === 'string' ? [style] : [] });
  if (!r.ok) return { error: r.error };
  kickSimQueue();
  revalidatePath('/sim');
  redirect('/sim');
}

export async function deleteSimAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const r = await deleteMySim(getDb(), member.userId, formData.get('simId'));
  if (!r.ok) return { error: r.error };
  revalidatePath('/sim');
  return {};
}
