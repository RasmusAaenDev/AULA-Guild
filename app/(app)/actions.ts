'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { addCharacter, setActiveCharacter, setRole, unlinkCharacter } from '@/lib/characters';
import { getDb } from '@/lib/db';
import { roles, type Role } from '@/lib/db/schema';
import { addCharacterMessage } from '@/lib/messages';
import { charactersDeps } from '@/lib/services';
import { requireMember, requireOfficer } from '@/lib/session';

export type AddState = { error?: string };

function toId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toRole(value: FormDataEntryValue | null): Role | null {
  return roles.find((r) => r === value) ?? null;
}

export async function setActiveAction(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = toId(formData.get('characterId'));
  if (id) await setActiveCharacter(getDb(), member.userId, id);
  revalidatePath('/', 'layout');
}

export async function setRoleAction(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = toId(formData.get('characterId'));
  const role = toRole(formData.get('role'));
  if (id && role) await setRole(getDb(), member.userId, id, role);
  revalidatePath('/', 'layout');
}

export async function unlinkAction(formData: FormData): Promise<void> {
  await requireOfficer();
  const id = toId(formData.get('characterId'));
  if (id) await unlinkCharacter(getDb(), id);
  revalidatePath('/', 'layout');
}

export async function addCharacterAction(_prev: AddState, formData: FormData): Promise<AddState> {
  const member = await requireMember();
  const role = toRole(formData.get('role'));
  const name = String(formData.get('name') ?? '');
  if (!role) return { error: 'Vælg en rolle.' };
  const result = await addCharacter(charactersDeps(), { userId: member.userId, name, role });
  if (!result.ok) return { error: addCharacterMessage(result.reason) };
  revalidatePath('/', 'layout');
  redirect('/kontakter');
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
