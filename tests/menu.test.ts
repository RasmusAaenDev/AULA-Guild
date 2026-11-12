import { describe, expect, it } from 'vitest';
import { LOCKED_LABEL, menuHref, menuItems } from '@/lib/menu';

describe('menuItems', () => {
  it('viser altid Beskeder efter Kalender, også uden Discord', () => {
    expect(menuItems().map((m) => m.label)).toEqual(['Overblik', 'Kalender', 'Beskeder', 'Galleri', 'Kontakter', 'Filer']);
  });
  it('viser Sim efter Beskeder kun når simulatoren er sat op', () => {
    expect(menuItems({ simEnabled: true }).map((m) => m.label)).toEqual(['Overblik', 'Kalender', 'Beskeder', 'Skolehjem', 'Galleri', 'Kontakter', 'Filer']);
    expect(menuItems({ simEnabled: false }).some((m) => m.href === '/sim')).toBe(false);
  });
  it('har tæller på Overblik (opslag) og Kalender (events), ellers ingen', () => {
    const items = menuItems();
    expect(items.filter((m) => m.badge).map((m) => [m.label, m.badge])).toEqual([['Overblik', 'posts'], ['Kalender', 'events']]);
  });
  it('har unikke links', () => {
    const hrefs = menuItems().map((m) => m.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('menuItems for gæst, medlem og officer', () => {
  const guest = { isGuildMember: false, isOfficer: false };
  const memberV = { isGuildMember: true, isOfficer: false };
  const officer = { isGuildMember: true, isOfficer: true };

  it('gæst: Skolehjem, Galleri og Filer vises låst og linker til /ingen-adgang; resten er åbne', () => {
    const items = menuItems({ simEnabled: true, viewer: guest });
    expect(items.map((m) => m.label)).toEqual(['Overblik', 'Kalender', 'Beskeder', 'Skolehjem', 'Galleri', 'Kontakter', 'Filer']);
    expect(items.filter((m) => m.locked).map((m) => m.label)).toEqual(['Skolehjem', 'Galleri', 'Filer']);
    expect(items.filter((m) => m.locked).map(menuHref)).toEqual(['/ingen-adgang', '/ingen-adgang', '/ingen-adgang']);
    expect(items.filter((m) => !m.locked).map(menuHref)).toEqual(['/', '/kalender', '/chat', '/kontakter']);
  });

  it('medlem og officer: intet er låst', () => {
    for (const viewer of [memberV, officer]) {
      const items = menuItems({ simEnabled: true, viewer });
      expect(items.some((m) => m.locked)).toBe(false);
      expect(items.map(menuHref)).toEqual(items.map((m) => m.href));
    }
  });

  it('gæst uden simulator: Skolehjem vises slet ikke, Galleri og Filer er låst', () => {
    expect(menuItems({ viewer: guest }).filter((m) => m.locked).map((m) => m.label)).toEqual(['Galleri', 'Filer']);
  });

  it('har en tilgængelig låsetekst', () => {
    expect(LOCKED_LABEL).toBe('kræver guild-medlemskab');
  });
});
