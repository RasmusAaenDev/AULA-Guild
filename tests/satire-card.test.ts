import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SatireCard } from '@/components/SatireCard';
import type { DatedSatire } from '@/lib/satire';

const now = new Date('2026-11-10T12:00:00Z');
const post: DatedSatire = {
  at: new Date('2026-11-10T08:05:00Z'),
  id: 'x',
  title: 'Husk madpakker',
  body: 'Første afsnit.\n\nAnden afsnit.',
  author: 'Fru Opdigtet (fiktiv)',
  important: true,
  tags: [],
  comments: [
    { author: 'Hr. Hansen', body: 'Tak for info.' },
    { author: 'Fru Falsk', body: 'Hvornår?' },
  ],
};
const html = renderToStaticMarkup(createElement(SatireCard, { post, now }));
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('SatireCard', () => {
  it('viser ingen synlig tekst om fake/satire/fiktiv', () => {
    const visible = html.replace(/<[^>]*>/g, ' ');
    expect(visible).not.toMatch(/fake|satire|fiktiv|opdigtede/i);
  });
  it('annoncerer kun én gang «Fake opslag (satire)»', () => {
    expect(count(html, 'aria-label="Fake opslag (satire)"')).toBe(1);
    expect(count(html, 'Fake opslag (satire)')).toBe(1);
  });
  it('viser forfatter uden «(fiktiv)»', () => {
    expect(html).toContain('<strong>Fru Opdigtet</strong>');
    expect(html).not.toContain('(fiktiv)');
  });
  it('viser tidspunktet i <time> som på ægte opslag, uden anden tekst', () => {
    expect(html).toContain('<time class="muted" dateTime="2026-11-10T08:05:00.000Z" title="10.11.2026 09.05">I dag 09:05</time>');
    expect(count(html, '<time')).toBe(1);
  });
  it('bruger klovne/joker-ikonet som skjult avatar', () => {
    expect(html).toMatch(/<span class="satire-mask" aria-hidden="true"><svg[^>]*aria-hidden="true"[^>]*data-icon="klovn"/);
  });
  it('har ikonet inde i overskriften', () => {
    const h3 = html.match(/<h3[^>]*>[\s\S]*?<\/h3>/)![0];
    expect(h3).toContain('data-icon="klovn"');
    expect(h3).toContain('Husk madpakker');
  });
  it('har ingen links eller knapper', () => {
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<button');
  });
});
