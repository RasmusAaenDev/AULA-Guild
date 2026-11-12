'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SATIRE_COOKIE, SATIRE_COOKIE_MAX_AGE } from '@/lib/satire';
import { requireUser } from '@/lib/session';

/** Slår satire-opslag fra/til. Cookien er ikke følsom (derfor ikke httpOnly) og læses server-side af Overblik. */
export async function setSatirePreferenceAction(formData: FormData): Promise<void> {
  await requireUser();
  const value = formData.get('satire');
  if (value !== 'on' && value !== 'off') return;
  (await cookies()).set(SATIRE_COOKIE, value, {
    maxAge: SATIRE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  });
  revalidatePath('/', 'layout');
}
