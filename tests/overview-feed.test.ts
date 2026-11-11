import { describe, expect, it } from 'vitest';
import { mergeTimeline } from '@/lib/overview-feed';

const now = new Date('2026-11-10T12:00:00Z');
const t = (h: number) => new Date(now.getTime() - h * 3_600_000);
const real = (item: string, h: number, pinned = false) => ({ item, at: t(h), pinned });
const other = (item: string, h: number) => ({ item, at: t(h) });
const show = (r: Array<{ item: unknown }>) => r.map((e) => e.item).join(' ');
const base = { chat: [], satire: [], hasOlder: true, now };

describe('mergeTimeline', () => {
  it('sorterer ægte, chat og satire nyeste først inden for vinduet', () => {
    const out = mergeTimeline({
      real: [real('r1', 1), real('r2', 10), real('r3', 30)],
      chat: [other('c1', 5), other('c0', 40)],
      satire: [other('s1', 2), other('s2', 20), other('s0', 31)],
      hasOlder: true,
      now,
    });
    expect(show(out)).toBe('r1 s1 c1 r2 s2 r3');
  });
  it('bruger nu − 14 dage som vindue uden ældre side eller med under 3 ægte opslag', () => {
    const chat = [other('c', 24 * 13), other('old', 24 * 15)];
    expect(show(mergeTimeline({ ...base, real: [real('a', 1), real('b', 2), real('c', 3)], chat, hasOlder: false }))).toBe('a b c c');
    expect(show(mergeTimeline({ ...base, real: [real('a', 1), real('b', 2)], chat }))).toBe('a b c');
    expect(show(mergeTimeline({ ...base, real: [real('a', 1), real('b', 2), real('c', 3)], chat }))).toBe('a b c');
  });
  it('ved lighed kommer ægte før chat før satire, og ellers stabilt', () => {
    const out = mergeTimeline({
      real: [real('r1', 3), real('r2', 3), real('r0', 0)],
      chat: [other('c1', 3), other('c2', 3)],
      satire: [other('s1', 3), other('s2', 3)],
      hasOlder: false,
      now,
    });
    expect(show(out)).toBe('r0 r1 r2 c1 c2 s1 s2');
  });
  it('lægger fastgjorte ægte opslag øverst uden at sortere dem ind, og de påvirker ikke vinduet', () => {
    const out = mergeTimeline({
      real: [real('p1', 500, true), real('p2', 400, true), real('a', 1), real('b', 2), real('c', 3)],
      chat: [other('c', 1.5), other('gammel', 100)],
      satire: [other('s', 0.5)],
      hasOlder: true,
      now,
    });
    expect(show(out)).toBe('p1 p2 s a c b c');
    expect(out.map((e) => e.kind)).toEqual(['real', 'real', 'satire', 'real', 'chat', 'real', 'real']);
  });
  it('viser ingen satire, når den ikke gives, og tom chat er i orden', () => {
    const out = mergeTimeline({ ...base, real: [real('a', 1), real('b', 2), real('c', 3)], satire: [], chat: [] });
    expect(out.map((e) => e.kind)).toEqual(['real', 'real', 'real']);
  });
  it('giver tomt feed uden fejl, og kun chat/satire hvis der ikke er ægte opslag', () => {
    expect(mergeTimeline({ ...base, real: [], hasOlder: false })).toEqual([]);
    const out = mergeTimeline({ ...base, real: [], chat: [other('c', 1)], satire: [other('s', 2), other('x', 24 * 20)], hasOlder: false });
    expect(show(out)).toBe('c s');
  });
  it('rører ikke ved sine inddata', () => {
    const r = [real('a', 5), real('b', 1)];
    mergeTimeline({ ...base, real: r });
    expect(r.map((x) => x.item)).toEqual(['a', 'b']);
  });
});
