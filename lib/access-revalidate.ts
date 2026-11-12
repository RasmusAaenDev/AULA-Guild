import type { Access } from '@/lib/discord-access';

export const REVALIDATE_TTL_MS = 10 * 60 * 1000;

/**
 * Husker Discord-opslag pr. bruger i hukommelsen, så en 30 dages session tjekkes mod guilden højst hvert 10. minut
 * pr. bruger (og ikke ved hver sidevisning). `lookup` kaster ved midlertidige fejl: så beholdes den gamle adgang, og der
 * prøves igen ved næste anmodning (kun efter en kort pause, så en Discord-fejl ikke giver et opslag pr. sidevisning).
 */
export function createAccessRevalidator(opts: {
  lookup: (discordId: string) => Promise<Access>;
  now?: () => number;
  ttlMs?: number;
  errorBackoffMs?: number;
  maxEntries?: number;
}) {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? REVALIDATE_TTL_MS;
  const backoff = opts.errorBackoffMs ?? 30_000;
  const max = opts.maxEntries ?? 1000;
  const cache = new Map<string, { at: number; access: Access | null }>();
  const inflight = new Map<string, Promise<Access | null>>();
  return {
    /** Frisk adgang, eller null hvis den ikke kunne afgøres (så skal kalderen beholde det, den har). */
    async check(discordId: string): Promise<Access | null> {
      const t = now();
      const hit = cache.get(discordId);
      if (hit && t - hit.at < (hit.access ? ttl : backoff)) return hit.access;
      let p = inflight.get(discordId);
      if (!p) {
        p = opts
          .lookup(discordId)
          .then((a): Access | null => a)
          .catch(() => null)
          .then((a) => {
            if (cache.size >= max) cache.delete(cache.keys().next().value as string);
            cache.set(discordId, { at: now(), access: a });
            return a;
          })
          .finally(() => inflight.delete(discordId));
        inflight.set(discordId, p);
      }
      return p;
    },
  };
}
