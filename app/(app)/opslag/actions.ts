'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { parseId } from '@/lib/parse';
import { addComment, createPost, deleteComment, deletePost, markPostRead, setPinned, toggleBookmark } from '@/lib/posts';
import { commentNotFound, postMessage } from '@/lib/posts-ui';
import { requireMember, requireOfficer } from '@/lib/session';

export type FormState = { error?: string };

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

/** Opdaterer Overblik, tælleren i layoutet og evt. opslagssiden. */
function revalidatePosts(postId?: number) {
  revalidatePath('/', 'layout');
  if (postId !== undefined) revalidatePath(`/opslag/${postId}`);
}

export async function createPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const result = await createPost(getDb(), member.userId, {
    title: field(formData, 'title'),
    body: field(formData, 'body'),
  });
  if (!result.ok) return { error: postMessage(result.reason) };
  revalidatePosts();
  redirect(`/opslag/${result.postId}`);
}

export async function addCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const postId = parseId(field(formData, 'postId'));
  if (postId === null) return { error: postMessage('not_found') };
  const result = await addComment(getDb(), member.userId, postId, field(formData, 'body'));
  if (!result.ok) {
    if (result.reason === 'not_found') revalidatePosts(postId);
    return { error: postMessage(result.reason, 'comment') };
  }
  revalidatePosts(postId);
  return {};
}

// Slet og fastgør har samme signatur som de øvrige formularhandlinger, så ConfirmForm kan genbruges.
export async function deletePostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const postId = parseId(field(formData, 'postId'));
  if (postId === null) return { error: postMessage('not_found') };
  const result = await deletePost(getDb(), member, postId);
  if (!result.ok) {
    if (result.reason === 'not_found') revalidatePosts(postId);
    return { error: postMessage(result.reason) };
  }
  revalidatePosts(postId);
  redirect('/');
}

export async function deleteCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const postId = parseId(field(formData, 'postId'));
  const commentId = parseId(field(formData, 'commentId'));
  if (commentId === null) return { error: commentNotFound };
  const result = await deleteComment(getDb(), member, commentId);
  revalidatePosts(postId ?? undefined);
  if (!result.ok) return { error: result.reason === 'not_found' ? commentNotFound : postMessage(result.reason) };
  return {};
}

export async function setPinnedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireOfficer();
  const postId = parseId(field(formData, 'postId'));
  if (postId === null) return { error: postMessage('not_found') };
  const result = await setPinned(getDb(), member, postId, field(formData, 'pinned') === 'true');
  revalidatePosts(postId);
  if (!result.ok) return { error: postMessage(result.reason) };
  return {};
}

export async function markReadAction(postId: number): Promise<void> {
  const member = await requireMember();
  const id = parseId(String(postId));
  if (id === null) return;
  await markPostRead(getDb(), member.userId, id);
  revalidatePath('/', 'layout');
}

/** Gem/fjern bogmærke. Brugerens eget bogmærke; kræver kun medlemskab. */
export async function toggleBookmarkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const postId = parseId(field(formData, 'postId'));
  if (postId === null) return { error: postMessage('not_found') };
  const result = await toggleBookmark(getDb(), member.userId, postId);
  revalidatePosts(postId);
  if (!result.ok) return { error: postMessage(result.reason) };
  return {};
}
