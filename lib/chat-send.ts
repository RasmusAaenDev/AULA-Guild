// Ren logik til at skrive i chatten: validering af beskedteksten og rate-limit pr. bruger (bruges også af simulatoren).

export const MAX_MESSAGE_CHARS = 500;
export const MAX_LINE_BREAKS = 5;

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
