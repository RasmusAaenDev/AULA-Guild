'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { signIn, signOut } from '@/auth';
import { addCharacter, setActiveCharacter, setRole, unlinkCharacter } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { roles, type Role } from '@/lib/db/schema';
import { addCharacterMessage } from '@/lib/messages';
import { parseId, parseLocalPath } from '@/lib/parse';
import { charactersDeps } from '@/lib/services';
import { requireUser, requireOfficer } from '@/lib/session';

/** `name`/`role` sendes tilbage ved fejl, så formularen kan genindsætte det indtastede uden JavaScript. */
export type AddState = { error?: string; name?: string; role?: string };

function toRole(value: FormDataEntryValue | null): Role | null {
  return roles.find((r) => r === value) ?? null;
}

export async function setActiveAction(formData: FormData): Promise<void> {
  const member = await requireUser();
  const id = parseId(formData.get('characterId'));
  if (id) await setActiveCharacter(getDb(), member.userId, id);
  revalidatePath('/', 'layout');
}

export async function setRoleAction(formData: FormData): Promise<void> {
  const member = await requireUser();
  const id = parseId(formData.get('characterId'));
  const role = toRole(formData.get('role'));
  if (id && role) await setRole(getDb(), member.userId, id, role);
  revalidatePath('/', 'layout');
}

export async function unlinkAction(formData: FormData): Promise<void> {
  await requireOfficer();
  const id = parseId(formData.get('characterId'));
  if (id) await unlinkCharacter(getDb(), id);
  revalidatePath('/', 'layout');
}

export async function addCharacterAction(_prev: AddState, formData: FormData): Promise<AddState> {
  const member = await requireUser();
  const role = toRole(formData.get('role'));
  const name = String(formData.get('name') ?? '');
  if (!role) return { error: 'Vælg en rolle.', name };
  const result = await addCharacter(charactersDeps(), { userId: member.userId, name, role });
  if (!result.ok) return { error: addCharacterMessage(result.reason), name, role };
  revalidatePath('/', 'layout');
  redirect('/kontakter');
}

/**
 * «Opdatér mine karakterer»: Battle.net-tokenet gemmes ikke, så brugeren sendes gennem Battle.net-login igen; login henter
 * kontoens karakterer og verificerer dem (se applySignIn). Bagefter tilbage til `back` (kun stier på siden selv).
 */
export async function refreshAccountCharactersAction(formData: FormData): Promise<void> {
  await requireUser();
  await signIn('battlenet', { redirectTo: parseLocalPath(formData.get('back')) ?? '/' });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
