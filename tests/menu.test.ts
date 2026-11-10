import { describe, expect, it } from 'vitest';
import { menuItems } from '@/lib/menu';

describe('menuItems', () => {
  it('viser altid Beskeder efter Kalender, også uden Discord', () => {
    expect(menuItems().map((m) => m.label)).toEqual(['Overblik', 'Kalender', 'Beskeder', 'Galleri', 'Kontakter', 'Filer']);
  });
  it('viser Sim efter Beskeder kun når simulatoren er sat op', () => {
    expect(menuItems({ simEnabled: true }).map((m) => m.label)).toEqual(['Overblik', 'Kalender', 'Beskeder', 'Sim', 'Galleri', 'Kontakter', 'Filer']);
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
