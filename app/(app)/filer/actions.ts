'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { deleteFile, setFilePinned } from '@/lib/files';
import { fileMessage } from '@/lib/files-ui';
import { parseId } from '@/lib/parse';
import { requireMember } from '@/lib/session';
import { filesDeps } from '@/lib/services';

export type FormState = { error?: string };

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function revalidateFiles() {
  revalidatePath('/filer');
  revalidatePath('/galleri');
}

// Samme signatur som de øvrige formularhandlinger, så ConfirmForm kan genbruges. Rettigheder tjekkes i lib/files.
export async function deleteFileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const fileId = parseId(field(formData, 'fileId'));
  if (fileId === null) return { error: fileMessage('not_found') };
  const { uploadDir } = filesDeps();
  const result = await deleteFile({ db: getDb(), uploadDir }, member, fileId);
  revalidateFiles();
  if (!result.ok) return { error: fileMessage(result.reason) };
  return {};
}

export async function setFilePinnedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const fileId = parseId(field(formData, 'fileId'));
  if (fileId === null) return { error: fileMessage('not_found') };
  const result = await setFilePinned(getDb(), member, fileId, field(formData, 'pinned') === 'true');
  revalidateFiles();
  if (!result.ok) return { error: fileMessage(result.reason) };
  return {};
}
