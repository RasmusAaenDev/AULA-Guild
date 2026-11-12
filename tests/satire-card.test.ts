import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SatireCard, avatarIndex, SATIRE_AVATAR_COLORS } from '@/components/SatireCard';
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
    { author: 'Hr. Hansen (fiktiv)', body: 'Tak for info.' },
    { author: 'Fru Falsk (fiktiv)', body: 'Til Hr. Hansen: Hvornår?' },
  ],
};
const many: DatedSatire = {
  ...post,
  comments: Array.from({ length: 10 }, (_, i) => ({ author: `Forælder ${i + 1} (fiktiv)`, body: `Kommentar nummer ${i + 1}.` })),
};
const manyHtml = renderToStaticMarkup(createElement(SatireCard, { post: many, now }));
const fourHtml = renderToStaticMarkup(createElement(SatireCard, { post: { ...many, comments: many.comments.slice(0, 4) }, now }));
const noneHtml = renderToStaticMarkup(createElement(SatireCard, { post: { ...post, comments: [] }, now }));
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

describe('SatireCard: kommentarer', () => {
  it('viser hver kommentar som et listepunkt med initial-avatar, navn uden «(fiktiv)» og tekst', () => {
    expect(html).toContain('<h4>Kommentarer (2)</h4>');
    expect(count(html, '<li class="satire-comment')).toBe(2);
    expect(html).toMatch(/<span class="satire-avatar sat-av-\d" aria-hidden="true">H<\/span>/);
    expect(html).toContain('<strong class="satire-comment-name">Hr. Hansen</strong>');
    expect(html).toContain('<p>Tak for info.</p>');
    expect(html).not.toContain('<details');
  });
  it('indrykker svar, der starter med «Til X:»', () => {
    expect(html).toContain('<li class="satire-comment is-reply">');
    expect(count(html, 'is-reply')).toBe(1);
  });
  it('viser de første 3 og lægger resten bag en lukket <details> med antal', () => {
    expect(manyHtml).toContain('<h4>Kommentarer (10)</h4>');
    expect(count(manyHtml, '<li class="satire-comment')).toBe(10);
    const [before, after] = manyHtml.split('<details');
    expect(count(before, '<li ')).toBe(3);
    expect(count(after, '<li ')).toBe(7);
    expect(after).toContain('<summary>Vis 7 flere kommentarer</summary>');
    expect(after).toContain('start="4"');
    expect(manyHtml).not.toMatch(/<details[^>]*open/);
    for (let i = 1; i <= 10; i++) expect(manyHtml).toContain(`Kommentar nummer ${i}.`);
    expect(fourHtml).toContain('<summary>Vis 1 kommentar mere</summary>');
  });
  it('har ingen kommentarsektion uden kommentarer', () => {
    expect(noneHtml).not.toContain('satire-comments');
    expect(noneHtml).not.toContain('Kommentarer');
  });
  it('giver samme farve til samme navn og holder sig inden for paletten', () => {
    expect(avatarIndex('Idas mor (fiktiv)')).toBe(avatarIndex('Idas mor'));
    for (const n of ['Idas mor', 'Oscars far', 'SFO-personalet', 'Klasselærer Anja']) {
      expect(avatarIndex(n)).toBeGreaterThanOrEqual(0);
      expect(avatarIndex(n)).toBeLessThan(SATIRE_AVATAR_COLORS);
    }
  });
  it('viser heller ikke «fiktiv» i mange kommentarer', () => {
    expect(manyHtml.replace(/<[^>]*>/g, ' ')).not.toMatch(/fake|satire|fiktiv|opdigtede/i);
  });
});
