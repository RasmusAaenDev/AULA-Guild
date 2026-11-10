'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireMember } from '@/lib/session';
import { createChannel, createChannelLimiter, createMessageLimiter, deleteChannel, deleteMessage, postMessage } from '@/lib/site-chat';
import type { FormState } from './actions';

const channelLimiter = createChannelLimiter();
const messageLimiter = createMessageLimiter();

export async function createSiteChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const r = await createChannel(getDb(), { userId: member.userId, limiter: channelLimiter, now: Date.now() }, formData.get('name'));
  if (!r.ok) return { error: r.error };
  redirect(`/chat?kanal=egen-${r.channel.id}`);
}

export async function sendSiteMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const r = await postMessage(getDb(), { userId: member.userId, limiter: messageLimiter, now: Date.now() }, formData.get('channelId'), formData.get('message'));
  return r.ok ? { sent: true } : { error: r.error };
}

export async function deleteSiteChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const r = await deleteChannel(getDb(), member, formData.get('channelId'));
  if (!r.ok) return { error: r.error };
  redirect('/chat');
}

export async function deleteSiteMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const r = await deleteMessage(getDb(), member, formData.get('messageId'));
  return r.ok ? {} : { error: r.error };
}
