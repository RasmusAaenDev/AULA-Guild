import { describe, expect, it } from 'vitest';
import { linkify, MAX_LINK_DISPLAY } from '@/lib/linkify';

const t = (text: string) => ({ type: 'text', text });
const l = (href: string, text = href) => ({ type: 'link', text, href });

describe('linkify', () => {
  it('tom streng giver ingen dele', () => expect(linkify('')).toEqual([]));
  it('almindelig tekst uden link', () => expect(linkify('hej verden')).toEqual([t('hej verden')]));
  it('en URL midt i en sætning', () => {
    expect(linkify('se https://example.com/a?b=1 nu')).toEqual([t('se '), l('https://example.com/a?b=1'), t(' nu')]);
  });
  it('flere URL\'er og rækkefølgen bevares', () => {
    expect(linkify('a http://x.dk b https://y.dk c')).toEqual([t('a '), l('http://x.dk'), t(' b '), l('https://y.dk'), t(' c')]);
  });
  it('klipper afsluttende punkt, komma, kolon og udråbstegn', () => {
    for (const end of ['.', ',', ';', ':', '!', '?', '.)', '?!']) {
      expect(linkify(`https://x.dk/a${end}`)).toEqual([l('https://x.dk/a'), t(end)]);
    }
  });
  it('klipper ubalanceret lukkeparentes men beholder balanceret', () => {
    expect(linkify('(se https://x.dk/a)')).toEqual([t('(se '), l('https://x.dk/a'), t(')')]);
    expect(linkify('https://en.wikipedia.org/wiki/Foo_(bar).')).toEqual([l('https://en.wikipedia.org/wiki/Foo_(bar)'), t('.')]);
  });
  it('håndterer <url>-formen', () => {
    expect(linkify('se <https://x.dk/a.> nu')).toEqual([t('se '), l('https://x.dk/a.'), t(' nu')]);
  });
  it('lukkende > uden åbnende klippes af linket', () => {
    expect(linkify('https://x.dk/a>')).toEqual([l('https://x.dk/a'), t('>')]);
  });
  it('ikke-http-skemaer bliver tekst', () => {
    for (const s of ['javascript:alert(1)', 'data:text/html,hej', 'ftp://x.dk', 'mailto:a@b.dk', '<javascript:alert(1)>']) {
      expect(linkify(s)).toEqual([t(s)]);
    }
  });
  it('http:// uden vært bliver tekst', () => expect(linkify('http://')).toEqual([t('http://')]));
  it('forkorter lange URL\'er i visningen men ikke i href', () => {
    const url = 'https://example.com/' + 'a'.repeat(200);
    const [p] = linkify(url);
    expect(p.href).toBe(url);
    expect([...p.text]).toHaveLength(MAX_LINK_DISPLAY);
    expect(p.text.endsWith('…')).toBe(true);
  });
  it('sammensætning af dele giver oprindelig tekst (uden <>)', () => {
    const text = 'a https://x.dk, og (http://y.dk/z) samt\nhttps://w.dk.';
    expect(linkify(text).map((p) => (p.type === 'link' ? p.href : p.text)).join('')).toBe(text);
  });
});
