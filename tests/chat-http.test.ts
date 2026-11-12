import { describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db';
import { chatResponse, parseSiteChannel } from '@/lib/chat-http';

// Ingen af disse tilfælde når databasen; en db der kaster, bekræfter det.
const db = new Proxy({}, { get: () => { throw new Error('databasen må ikke røres'); } }) as Db;

describe('chatResponse', () => {
  it('401 JSON uden session, før noget andet', async () => {
    for (const user of [undefined, { isGuildMember: true }, { isGuildMember: true, id: 0 }]) {
      const res = await chatResponse(user, 'egen-1', db);
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ error: 'Du skal være logget ind.' });
    }
  });
  it('400 når kanalen mangler', async () => {
    const res = await chatResponse({ id: '1' }, null, db);
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Kanal mangler.' });
  });
  it('404 for alt andet end en egen kanal', async () => {
    for (const k of ['123456789012345678', 'egen-', 'egen-abc', 'egen-0', 'egen-99999999999']) {
      const res = await chatResponse({ id: '1' }, k, db);
      expect(res.status, k).toBe(404);
      expect(await res.json()).toEqual({ error: 'Kanalen findes ikke.' });
    }
  });
});

describe('parseSiteChannel', () => {
  it('kender kun `egen-<id>`', () => {
    expect(parseSiteChannel('egen-7')).toBe(7);
    for (const v of ['7', '123456789012345678', 'egen-x', undefined, 7]) expect(parseSiteChannel(v)).toBeNull();
  });
});
