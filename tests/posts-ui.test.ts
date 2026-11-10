import { describe, expect, it } from 'vitest';
import {
  excerptText, formatAbsolute, formatRelative, parsePage, parseTab, postMessage, unreadLabel,
} from '@/lib/posts-ui';

describe('parseTab', () => {
  it('kender de tre faner og falder tilbage til alle', () => {
    expect(parseTab('alle')).toBe('alle');
    expect(parseTab('ulaeste')).toBe('ulaeste');
    expect(parseTab('vigtige')).toBe('vigtige');
    expect(parseTab('x')).toBe('alle');
    expect(parseTab(undefined)).toBe('alle');
    expect(parseTab(['ulaeste', 'vigtige'])).toBe('alle');
  });
});

describe('parsePage', () => {
  it('giver positive heltal, ellers 1', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('1.5')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage(['2'])).toBe(1);
    expect(parsePage('99999999999')).toBe(1);
    expect(parsePage('2000000')).toBe(1_000_000);
  });
});

describe('postMessage', () => {
  it('giver danske beskeder', () => {
    expect(postMessage('not_found')).toBe('Opslaget findes ikke længere.');
    expect(postMessage('forbidden')).toMatch(/lov/);
    expect(postMessage('invalid')).toMatch(/Titel/);
  });
  it('kommentarbesked nævner kommentaren', () => {
    expect(postMessage('invalid', 'comment')).toMatch(/Kommentar/);
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  it('kort efter', () => {
    expect(formatRelative(new Date('2026-11-10T11:59:40Z'), now)).toBe('lige nu');
    expect(formatRelative(new Date('2026-11-10T12:00:30Z'), now)).toBe('lige nu');
  });
  it('minutter og timer', () => {
    expect(formatRelative(new Date('2026-11-10T11:55:00Z'), now)).toBe('for 5 min. siden');
    expect(formatRelative(new Date('2026-11-10T09:00:00Z'), now)).toBe('for 3 timer siden');
    expect(formatRelative(new Date('2026-11-10T11:00:00Z'), now)).toBe('for 1 time siden');
  });
  it('ældre end et døgn giver absolut tid i dansk tid', () => {
    expect(formatRelative(new Date('2026-11-01T11:00:00Z'), now)).toBe('01.11.2026 12.00');
  });
});

describe('formatAbsolute', () => {
  it('bruger Europe/Copenhagen', () => {
    expect(formatAbsolute(new Date('2026-07-01T10:30:00Z'))).toBe('01.07.2026 12.30');
  });
});

describe('unreadLabel', () => {
  it('skjuler 0 og afkorter ved 99', () => {
    expect(unreadLabel(0)).toBeNull();
    expect(unreadLabel(-1)).toBeNull();
    expect(unreadLabel(5)).toBe('5');
    expect(unreadLabel(99)).toBe('99');
    expect(unreadLabel(100)).toBe('99+');
  });
});

describe('excerptText', () => {
  it('lader korte uddrag være, også på præcis grænsen', () => {
    expect(excerptText('Kort tekst')).toBe('Kort tekst');
    expect(excerptText('a'.repeat(200))).toBe('a'.repeat(200));
  });
  it('skærer og tilføjer ellipsis, når der er mere end grænsen', () => {
    expect(excerptText('a'.repeat(201))).toBe(`${'a'.repeat(200)}…`);
    expect(excerptText('ab c', 3)).toBe('ab…');
  });
  it('tæller tegn, ikke UTF-16-enheder', () => {
    expect(excerptText('\u{1F600}'.repeat(3), 3)).toBe('\u{1F600}'.repeat(3));
  });
});
