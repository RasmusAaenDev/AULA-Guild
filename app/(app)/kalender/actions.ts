'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { calendarMessage, timeMessage } from '@/lib/calendar-ui';
import { getDb } from '@/lib/db';
import { eventTypes, rsvpStatuses } from '@/lib/db/schema';
import { cancelEvent, createEvent, updateEvent } from '@/lib/events';
import { clearRsvp, setRsvp } from '@/lib/rsvps';
import { createSeries, deactivateSeries, updateSeries } from '@/lib/series';
import { parseId, parseWeekday } from '@/lib/parse';
import { requireMember, requireOfficer } from '@/lib/session';
import { copenhagenToUtc } from '@/lib/time';

export type FormState = { error?: string };

const FIELDS_ERROR = calendarMessage('invalid');
const text = (max: number) => z.string().trim().max(max);
const minutes = z.coerce.number().int().min(15).max(720);

const eventSchema = z.object({
  title: text(100).min(1),
  description: text(2000),
  date: z.string().trim(),
  time: z.string().trim(),
  // Tom varighed betyder «ingen varighed» for enkeltevents.
  durationMinutes: z.union([z.literal('').transform(() => null), minutes]),
});

const seriesSchema = z.object({
  type: z.enum(eventTypes),
  title: text(100).min(1),
  description: text(2000),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: minutes,
});

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function revalidateCalendar(eventId?: number) {
  revalidatePath('/', 'layout'); // tællere og bånd i layoutet
  revalidatePath('/kalender');
  revalidatePath('/kalender/serier');
  revalidatePath('/');
  if (eventId !== undefined) revalidatePath(`/kalender/${eventId}`);
}

export async function createEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const type = z.enum(eventTypes).safeParse(field(formData, 'type'));
  const parsed = eventSchema.safeParse({
    title: field(formData, 'title'),
    description: field(formData, 'description'),
    date: field(formData, 'date'),
    time: field(formData, 'time'),
    durationMinutes: field(formData, 'durationMinutes'),
  });
  if (!type.success || !parsed.success) return { error: FIELDS_ERROR };
  const at = copenhagenToUtc(parsed.data.date, parsed.data.time);
  if (!at.ok) return { error: timeMessage(at.reason) };
  const result = await createEvent(getDb(), member, {
    type: type.data,
    title: parsed.data.title,
    description: parsed.data.description,
    startsAt: at.utc,
    durationMinutes: parsed.data.durationMinutes,
  });
  if (!result.ok) return { error: calendarMessage(result.reason) };
  revalidateCalendar();
  redirect(`/kalender/${result.eventId}`);
}

export async function updateEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const eventId = parseId(field(formData, 'eventId'));
  const parsed = eventSchema.safeParse({
    title: field(formData, 'title'),
    description: field(formData, 'description'),
    date: field(formData, 'date'),
    time: field(formData, 'time'),
    durationMinutes: field(formData, 'durationMinutes'),
  });
  if (eventId === null || !parsed.success) return { error: FIELDS_ERROR };
  const at = copenhagenToUtc(parsed.data.date, parsed.data.time);
  if (!at.ok) return { error: timeMessage(at.reason) };
  const result = await updateEvent(getDb(), member, eventId, {
    title: parsed.data.title,
    description: parsed.data.description,
    startsAt: at.utc,
    durationMinutes: parsed.data.durationMinutes,
  });
  if (!result.ok) return { error: calendarMessage(result.reason) };
  revalidateCalendar(eventId);
  redirect(`/kalender/${eventId}`);
}

export async function cancelEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const eventId = parseId(field(formData, 'eventId'));
  if (eventId === null) return { error: calendarMessage('not_found') };
  const result = await cancelEvent(getDb(), member, eventId);
  if (!result.ok) return { error: calendarMessage(result.reason) };
  revalidateCalendar(eventId);
  return {};
}

export async function setRsvpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const eventId = parseId(field(formData, 'eventId'));
  const status = z.enum(rsvpStatuses).safeParse(field(formData, 'status'));
  if (eventId === null || !status.success) return { error: FIELDS_ERROR };
  const result = await setRsvp(getDb(), member.userId, eventId, status.data);
  if (!result.ok) {
    revalidateCalendar(eventId);
    return { error: calendarMessage(result.reason) };
  }
  revalidateCalendar(eventId);
  return {};
}

export async function clearRsvpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const eventId = parseId(field(formData, 'eventId'));
  if (eventId === null) return { error: FIELDS_ERROR };
  const result = await clearRsvp(getDb(), member.userId, eventId);
  revalidateCalendar(eventId);
  if (!result.ok) return { error: calendarMessage(result.reason) };
  return {};
}

function seriesInput(formData: FormData) {
  return seriesSchema.safeParse({
    type: field(formData, 'type'),
    title: field(formData, 'title'),
    description: field(formData, 'description'),
    weekday: parseWeekday(field(formData, 'weekday')),
    startTime: field(formData, 'startTime'),
    durationMinutes: field(formData, 'durationMinutes'),
  });
}

export async function createSeriesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireOfficer();
  const parsed = seriesInput(formData);
  if (!parsed.success) return { error: FIELDS_ERROR };
  const result = await createSeries(getDb(), member, parsed.data);
  if (!result.ok) return { error: calendarMessage(result.reason) };
  revalidateCalendar();
  redirect('/kalender/serier');
}

export async function updateSeriesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireOfficer();
  const seriesId = parseId(field(formData, 'seriesId'));
  const parsed = seriesInput(formData);
  if (seriesId === null || !parsed.success) return { error: FIELDS_ERROR };
  const result = await updateSeries(getDb(), member, seriesId, parsed.data);
  if (!result.ok) return { error: calendarMessage(result.reason) };
  revalidateCalendar();
  redirect(`/kalender/serier?kept=${result.keptWithRsvps}`);
}

export async function deactivateSeriesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await requireOfficer();
  const seriesId = parseId(field(formData, 'seriesId'));
  if (seriesId === null) return { error: calendarMessage('not_found') };
  const result = await deactivateSeries(getDb(), member, seriesId);
  if (!result.ok) return { error: calendarMessage(result.reason) };
  revalidateCalendar();
  redirect(`/kalender/serier?kept=${result.keptWithRsvps}`);
}
