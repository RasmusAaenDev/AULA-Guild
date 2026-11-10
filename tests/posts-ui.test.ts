import { describe, expect, it } from 'vitest';
import {
  excerptText, formatAbsolute, formatRelativeDay, parsePage, parseTab, postMessage, unreadLabel,
} from '@/lib/posts-ui';

describe('parseTab', () => {
  it('kender de seks faner og falder tilbage til alle', () => {
    expect(parseTab('alle')).toBe('alle');
    expect(parseTab('ulaeste')).toBe('ulaeste');
    expect(parseTab('vigtige')).toBe('vigtige');
    expect(parseTab('egne')).toBe('egne');
    expect(parseTab('gemte')).toBe('gemte');
    expect(parseTab('satire')).toBe('satire');
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

describe('formatRelativeDay', () => {
  // 2026-11-10 er en tirsdag; dansk normaltid (UTC+1)
  const now = new Date('2026-11-10T12:00:00Z');
  it('I dag og I går efter danske kalenderdage', () => {
    expect(formatRelativeDay(new Date('2026-11-10T08:05:00Z'), now)).toBe('I dag 09:05');
    expect(formatRelativeDay(new Date('2026-11-09T15:45:00Z'), now)).toBe('I går 16:45');
  });
  it('tæller dage efter dansk midnat, ikke 24 timer', () => {
    const lateNow = new Date('2026-11-10T23:30:00Z'); // 00:30 den 11. i Danmark
    expect(formatRelativeDay(new Date('2026-11-10T20:00:00Z'), lateNow)).toBe('I går 21:00');
    expect(formatRelativeDay(new Date('2026-11-10T23:10:00Z'), lateNow)).toBe('I dag 00:10');
  });
  it('ugedagsforkortelse for 2-6 dage siden', () => {
    expect(formatRelativeDay(new Date('2026-11-06T12:50:00Z'), now)).toBe('Fre. 13:50'); // fredag, 4 dage
    expect(formatRelativeDay(new Date('2026-11-08T08:00:00Z'), now)).toBe('Søn. 09:00');
    expect(formatRelativeDay(new Date('2026-11-04T08:00:00Z'), now)).toBe('Ons. 09:00'); // 6 dage
  });
  it('ældre end seks dage og fremtid giver dato og tid', () => {
    expect(formatRelativeDay(new Date('2026-11-03T08:00:00Z'), now)).toBe('03.11.2026 09.00');
    expect(formatRelativeDay(new Date('2026-11-10T13:00:00Z'), now)).toBe('10.11.2026 14.00');
    expect(formatRelativeDay(new Date('2026-11-12T13:00:00Z'), now)).toBe('12.11.2026 14.00');
  });
  it('håndterer sommertid', () => {
    const summer = new Date('2026-07-01T10:00:00Z'); // onsdag
    expect(formatRelativeDay(new Date('2026-06-30T14:45:00Z'), summer)).toBe('I går 16:45'); // UTC+2
    expect(formatRelativeDay(new Date('2026-06-27T08:00:00Z'), summer)).toBe('Lør. 10:00');
  });
  it('ugedage i dansk tid, ikke UTC', () => {
    const n = new Date('2026-11-12T12:00:00Z');
    expect(formatRelativeDay(new Date('2026-11-09T23:30:00Z'), n)).toBe('Tir. 00:30'); // tirsdag lokalt, mandag UTC
  });
});
