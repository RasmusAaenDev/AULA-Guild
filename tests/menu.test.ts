import { describe, expect, it } from 'vitest';
import { menuItems } from '@/lib/menu';

describe('menuItems', () => {
  it('har rækkefølgen Overblik, Kalender, Galleri, Kontakter, Filer uden chat', () => {
    expect(menuItems({ chat: false }).map((m) => m.label)).toEqual(['Overblik', 'Kalender', 'Galleri', 'Kontakter', 'Filer']);
  });
  it('sætter Chat efter Kalender når den er sat op', () => {
    expect(menuItems({ chat: true }).map((m) => m.label)).toEqual(['Overblik', 'Kalender', 'Chat', 'Galleri', 'Kontakter', 'Filer']);
  });
  it('har tæller på Overblik (opslag) og Kalender (events), ellers ingen', () => {
    const items = menuItems({ chat: true });
    expect(items.filter((m) => m.badge).map((m) => [m.label, m.badge])).toEqual([['Overblik', 'posts'], ['Kalender', 'events']]);
  });
  it('har unikke links', () => {
    const hrefs = menuItems({ chat: true }).map((m) => m.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
