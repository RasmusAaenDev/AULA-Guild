import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SatireCard } from '@/components/SatireCard';
import type { SatirePost } from '@/lib/satire';

const post: SatirePost = {
  id: 'x',
  title: 'Husk madpakker',
  body: 'Første afsnit.\n\nAnden afsnit.',
  author: 'Fru Opdigtet',
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
  it('viser badge og fodlinje', () => {
    expect(html).toContain('FAKE · SATIRE');
    expect(html).toContain('Dette er et fiktivt opslag. Alle personer er opdigtede.');
  });
  it('annoncerer kun én gang «Fake opslag (satire)»', () => {
    expect(count(html, 'aria-label="Fake opslag (satire)"')).toBe(1);
    expect(count(html, 'Fake opslag (satire)')).toBe(1);
  });
  it('erstatter tidsstempel med «Satire» og mærker hver kommentar «fiktiv»', () => {
    expect(html).toContain('<span class="satire-label">Satire</span>');
    expect(html).not.toMatch(/<time/);
    expect(count(html, '>fiktiv<')).toBe(post.comments.length);
  });
  it('har ingen links eller knapper', () => {
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<button');
  });
});
