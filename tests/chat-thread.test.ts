import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatThread, type ThreadMessage } from '@/app/(app)/chat/ChatThread';
import { AVATAR_COLORS, avatarColor, initialOf } from '@/lib/avatar';
import { buildThread, dayKey, dayLabel, formatClock, GROUP_GAP_MS } from '@/lib/chat-ui';

const now = new Date('2026-11-12T12:00:00Z');
const msg = (id: number, author: string, timestamp: string, extra: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id, author, content: `besked ${id}`, timestamp, ...extra,
});

describe('avatar', () => {
  it('giver samme farve for samme navn og altid et gyldigt indeks', () => {
    expect(avatarColor('Magi Far')).toBe(avatarColor('Magi Far'));
    for (const n of ['', 'A', 'Kamma', 'Æbleskive', '🙂 Smiley', 'Leyline Huntress']) {
      expect(avatarColor(n)).toBeGreaterThanOrEqual(0);
      expect(avatarColor(n)).toBeLessThan(AVATAR_COLORS);
    }
  });
  it('bruger første bogstav eller ciffer, stort', () => {
    expect(initialOf('kamma')).toBe('K');
    expect(initialOf('æble')).toBe('Æ');
    expect(initialOf('  [bot] 7ern')).toBe('B');
    expect(initialOf('🙂')).toBe('?');
  });
});

describe('dayKey/dayLabel/formatClock', () => {
  it('bruger dansk kalenderdag, ikke UTC', () => {
    expect(dayKey('2026-11-11T23:30:00Z')).toBe('2026-11-12');
    expect(dayKey('ikke en dato')).toBeNull();
  });
  it('siger «I dag», «I går» og ellers ugedag og dato, med år når det ikke er i år', () => {
    expect(dayLabel('2026-11-12', now)).toBe('I dag');
    expect(dayLabel('2026-11-11', now)).toBe('I går');
    expect(dayLabel('2026-11-09', now)).toMatch(/^Mandag .*9\. november$/);
    expect(dayLabel('2025-12-31', now)).toMatch(/^Onsdag .*31\. december 2025$/);
  });
  it('«I går» på tværs af månedsskifte', () => {
    expect(dayLabel('2026-10-31', new Date('2026-11-01T10:00:00Z'))).toBe('I går');
  });
  it('viser kun klokkeslæt i dansk tid', () => {
    expect(formatClock('2026-11-12T09:05:00Z')).toBe('10.05');
    expect(formatClock('vrøvl')).toBe('');
  });
});

describe('buildThread', () => {
  it('lægger en dagsskillelinje før hver ny dag', () => {
    const items = buildThread([
      msg(1, 'A', '2026-11-11T10:00:00Z'),
      msg(2, 'A', '2026-11-12T10:00:00Z'),
      msg(3, 'B', '2026-11-12T10:01:00Z'),
    ], now);
    expect(items.map((i) => (i.kind === 'day' ? i.label : i.msg.id))).toEqual(['I går', 1, 'I dag', 2, 3]);
  });
  it('grupperer samme afsender inden for få minutter, men ikke over grænsen', () => {
    const t0 = Date.parse('2026-11-12T10:00:00Z');
    const at = (ms: number) => new Date(t0 + ms).toISOString();
    const items = buildThread([
      msg(1, 'A', at(0)),
      msg(2, 'A', at(60_000)),
      msg(3, 'A', at(60_000 + GROUP_GAP_MS)),
      msg(4, 'A', at(120_000 + 2 * GROUP_GAP_MS)),
      msg(5, 'B', at(120_000 + 2 * GROUP_GAP_MS + 1000)),
      msg(6, 'A', at(120_000 + 2 * GROUP_GAP_MS + 2000)),
    ], now);
    const firsts = items.flatMap((i) => (i.kind === 'msg' ? [[i.msg.id, i.first]] : []));
    expect(firsts).toEqual([[1, true], [2, false], [3, false], [4, true], [5, true], [6, true]]);
  });
  it('bryder gruppen ved ny dag, ændret bot-status og ugyldigt eller baglæns tidspunkt', () => {
    const items = buildThread([
      msg(1, 'A', '2026-11-11T22:58:00Z'),
      msg(2, 'A', '2026-11-11T23:01:00Z'), // ny dansk dag
      msg(3, 'A', '2026-11-11T23:02:00Z', { bot: true }),
      msg(4, 'A', 'vrøvl', { bot: true }),
      msg(5, 'A', '2026-11-11T23:03:00Z', { bot: true }),
      msg(6, 'A', '2026-11-11T23:02:30Z', { bot: true }),
    ], now);
    const firsts = items.flatMap((i) => (i.kind === 'msg' ? [[i.msg.id, i.first]] : []));
    expect(firsts).toEqual([[1, true], [2, true], [3, true], [4, true], [5, true], [6, true]]);
    expect(items.filter((i) => i.kind === 'day')).toHaveLength(2);
  });
  it('giver tom liste for ingen beskeder', () => {
    expect(buildThread([], now)).toEqual([]);
  });
});

describe('ChatThread', () => {
  const html = (messages: ThreadMessage[]) => renderToStaticMarkup(createElement(ChatThread, { messages, now }));

  it('viser avatar og navn kun på første besked i en gruppe, og tidspunktet i rillen på de følgende', () => {
    const out = html([
      msg(1, 'Kamma', '2026-11-12T10:00:00Z'),
      msg(2, 'Kamma', '2026-11-12T10:01:00Z'),
    ]);
    expect(out.match(/class="chat-avatar sat-av-\d" aria-hidden="true">K</g)).toHaveLength(1);
    expect(out.match(/<strong class="chat-author">Kamma<\/strong>/g)).toHaveLength(1);
    expect(out).toContain('<p class="chat-day"><time dateTime="2026-11-12">I dag</time></p>');
    expect(out).toMatch(/class="chat-msg is-cont"><div class="chat-gutter"><time class="chat-time" dateTime="2026-11-12T10:01:00Z"[^>]*>11\.01<\/time>/);
    expect(out).toContain('<span class="sr-only">Kamma: </span>');
  });
  it('linker til armory, viser bot-mærke og gør links i teksten klikbare', () => {
    const out = html([msg(1, 'Magi Far', '2026-11-12T10:00:00Z', {
      armoryUrl: 'https://worldofwarcraft.blizzard.com/x', bot: true, content: 'se https://aula-forever.dk/',
    })]);
    expect(out).toContain('<a class="chat-link" href="https://worldofwarcraft.blizzard.com/x" target="_blank" rel="noopener noreferrer">Magi Far</a>');
    expect(out).toContain('<span class="badge">bot</span>');
    expect(out).toContain('href="https://aula-forever.dk/"');
  });
  it('markerer egne beskeder og viser handlinger', () => {
    const out = html([msg(1, 'Mig', '2026-11-12T10:00:00Z', { mine: true, actions: createElement('button', null, 'Slet') })]);
    expect(out).toContain('class="chat-msg is-first is-mine"');
    expect(out).toContain('<span class="sr-only">(dig)</span>');
    expect(out).toContain('<span class="chat-actions"><button>Slet</button></span>');
  });
  it('escaper indholdet (aldrig HTML)', () => {
    const out = html([msg(1, '<b>x</b>', '2026-11-12T10:00:00Z', { content: '<img src=x>' })]);
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<b>x</b>');
  });
});
