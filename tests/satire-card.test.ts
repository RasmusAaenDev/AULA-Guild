import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SatireCard } from '@/components/SatireCard';
import type { SatirePost } from '@/lib/satire';

const post: SatirePost = {
  id: 'x',
  title: 'Husk madpakker',
  body: 'Første afsnit.\n\nAnden afsnit.',
  author: 'Fru Opdigtet (fiktiv)',
  important: true,
  tags: [],
  comments: [
    { author: 'Hr. Fiktiv', body: 'Tak for info.' },
    { author: 'Fru Falsk', body: 'Hvornår?' },
  ],
};
const html = renderToStaticMarkup(createElement(SatireCard, { post }));
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('SatireCard', () => {
  it('viser fodlinje, men hverken badge eller «Satire»-etiket', () => {
    expect(html).not.toContain('FAKE · SATIRE');
    expect(html).not.toContain('satire-label');
    expect(html).not.toContain('satire-badge');
    expect(html).toContain('Dette er et fiktivt opslag. Alle personer er opdigtede.');
  });
  it('annoncerer kun én gang «Fake opslag (satire)»', () => {
    expect(count(html, 'aria-label="Fake opslag (satire)"')).toBe(1);
    expect(count(html, 'Fake opslag (satire)')).toBe(1);
  });
  it('viser forfatter uden «(fiktiv)» og mærker hver kommentar «fiktiv»', () => {
    expect(html).toContain('<strong>Fru Opdigtet</strong>');
    expect(html).not.toContain('(fiktiv)');
    expect(html).not.toMatch(/<time/);
    expect(count(html, '>fiktiv<')).toBe(post.comments.length);
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
