import { describe, expect, it } from 'vitest';
import type { ChatClient } from '@/lib/chat';
import type { Db } from '@/lib/db';
import { chatResponse } from '@/lib/chat-http';

// Ingen beskeder med forfattere i disse tests, så databasen røres ikke.
const db = {} as Db;
const chat: ChatClient = { listChannels: async () => ({ channels: [] }), getMessages: async () => ({ messages: [], stale: false }), sendMessage: async () => ({ ok: true }) };

describe('chatResponse', () => {
  it('401 JSON uden medlemssession', async () => {
    for (const user of [undefined, { isMember: false, id: '1' }, { isMember: true }]) {
      const res = await chatResponse(user, chat, '123', db);
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ error: 'Du skal være logget ind.' });
    }
  });
  it('404 JSON når chatten ikke er sat op', async () => {
    const res = await chatResponse({ isMember: true, id: '1' }, null, '123', db);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Chatten er ikke sat op.' });
  });
  it('200 med resultatet og no-store', async () => {
    const res = await chatResponse({ isMember: true, id: '1' }, chat, '123', db);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ messages: [], stale: false });
  });
  it('tjekker session før chat (ingen kald uden login)', async () => {
    let called = 0;
    await chatResponse(undefined, { listChannels: async () => ({ channels: [] }), getMessages: async () => { called++; return { messages: [], stale: false }; }, sendMessage: async () => ({ ok: true }) }, '123', db);
    expect(called).toBe(0);
  });
});
