// Ren logik til at skrive i chatten: validering, opbygning af Discord-teksten og rate-limit pr. bruger.
// Ingen netværk og intet token her; selve afsendelsen sker via ChatClient.sendMessage.

import type { ChatClient, SendResult } from '@/lib/chat';

export const MAX_MESSAGE_CHARS = 500;
export const MAX_LINE_BREAKS = 5;
export const MAX_CONTENT_CHARS = 1900;

export type ValidateResult = { ok: true; text: string } | { ok: false; error: string };

// Tab og linjeskift er tilladt; alle andre kontroltegn (C0, DEL, C1) og U+2028/2029 er ikke.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029]/;

/** Trimmer og validerer brugerens tekst. Fejlteksten er dansk og vises direkte til brugeren. */
export function validateMessage(raw: unknown): ValidateResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Skriv en besked først.' };
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (text === '') return { ok: false, error: 'Skriv en besked først.' };
  if ([...text].length > MAX_MESSAGE_CHARS) {
    return { ok: false, error: `Beskeden må højst være ${MAX_MESSAGE_CHARS} tegn.` };
  }
  if (CONTROL.test(text)) return { ok: false, error: 'Beskeden indeholder tegn, der ikke er tilladt.' };
  if (text.split('\n').length - 1 > MAX_LINE_BREAKS) {
    return { ok: false, error: `Beskeden må højst have ${MAX_LINE_BREAKS} linjeskift.` };
  }
  return { ok: true, text };
}

const ZWSP = '​';

/** Gør Discord-markdown og omtaler til almindelig tekst (backslash for markdown, usynligt mellemrum for omtaler). */
export function escapeDiscord(s: string): string {
  return s
    .replace(/[*_~`>|\\[\]]/g, '\\$&')
    .replace(/@/g, `@${ZWSP}`)
    .replace(/</g, `<${ZWSP}`);
}

/** Hele Discord-teksten: præfikset sættes altid først af serveren, brugerens tekst er kun almindelig tekst. */
export function buildContent(characterName: string, text: string): ValidateResult {
  const content = `**[Aula] ${escapeDiscord(characterName.trim())}:** ${escapeDiscord(text)}`;
  if ([...content].length > MAX_CONTENT_CHARS) return { ok: false, error: 'Beskeden er for lang.' };
  return { ok: true, text: content };
}

export type LimitResult = { ok: true } | { ok: false; error: string };

/** In-memory rate-limit pr. bruger: højst `max` beskeder pr. `windowMs` og mindst `minGapMs` imellem. */
export function createSendLimiter(opts: { max?: number; windowMs?: number; minGapMs?: number } = {}) {
  const max = opts.max ?? 5;
  const windowMs = opts.windowMs ?? 60_000;
  const minGapMs = opts.minGapMs ?? 2000;
  const sent = new Map<number, number[]>();
  return {
    /** Tjekker og registrerer i ét skridt; en afvist besked tæller ikke med. */
    take(userId: number, now: number): LimitResult {
      const recent = (sent.get(userId) ?? []).filter((t) => now - t < windowMs);
      const lastAt = recent.at(-1);
      if (lastAt !== undefined && now - lastAt < minGapMs) {
        sent.set(userId, recent);
        return { ok: false, error: 'Vent et øjeblik, før du sender igen.' };
      }
      if (recent.length >= max) {
        sent.set(userId, recent);
        return { ok: false, error: 'Du sender for hurtigt. Vent lidt og prøv igen.' };
      }
      recent.push(now);
      sent.set(userId, recent);
      if (sent.size > 1000) {
        for (const [id, ts] of sent) if (ts.every((t) => now - t >= windowMs)) sent.delete(id);
      }
      return { ok: true };
    },
  };
}

export type SendLimiter = ReturnType<typeof createSendLimiter>;

export function sendErrorMessage(error: Exclude<SendResult, { ok: true }>['error']): string {
  switch (error) {
    case 'no_access': return 'Botten har ikke rettigheden til at skrive i kanalen.';
    case 'rate_limited': return 'Discord beder om lidt ro. Prøv igen om lidt.';
    case 'invalid': return 'Discord afviste beskeden.';
    default: return 'Beskeden kunne ikke sendes lige nu. Prøv igen om lidt.';
  }
}

export type SubmitDeps = {
  userId: number;
  configured: boolean;
  chat: ChatClient | null;
  /** Fulde navn på brugerens aktive karakter, eller null. */
  characterName: string | null;
  limiter: SendLimiter;
  now: number;
};

/** Hele afsendelsesforløbet uden Next/DB, så det kan testes. Returnerer kun en dansk fejltekst eller ingenting. */
export async function submitChatMessage(deps: SubmitDeps, raw: unknown): Promise<{ error?: string }> {
  if (!deps.configured || !deps.chat) return { error: 'Chatten er ikke sat op.' };
  if (!deps.characterName) return { error: 'Vælg en karakter først.' };
  const valid = validateMessage(raw);
  if (!valid.ok) return { error: valid.error };
  const content = buildContent(deps.characterName, valid.text);
  if (!content.ok) return { error: content.error };
  const limit = deps.limiter.take(deps.userId, deps.now);
  if (!limit.ok) return { error: limit.error };
  const result = await deps.chat.sendMessage(content.text);
  return result.ok ? {} : { error: sendErrorMessage(result.error) };
}
