import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from '@/lib/contrast';

const css = readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');

function vars(selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {');
  if (start < 0) throw new Error(`Fandt ikke ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Tekstfarven fra `.navlink { … color: … }` (ikke hårdkodet). */
const navlinkColor = /\.navlink \{[^}]*?\bcolor:\s*(#[0-9a-fA-F]{3,6})\s*;/.exec(css)?.[1];
const light = vars(':root');
const darkMedia = vars(":root:not([data-theme='light'])");
const darkAttr = vars(":root[data-theme='dark']");
const dark = { ...light, ...darkAttr };

describe('contrastRatio', () => {
  it('giver 21 for sort/hvid og 1 for samme farve', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
  it('er symmetrisk og kender 3-cifrede farver', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(contrastRatio('#000', '#fff'), 10);
    expect(luminance('#fff')).toBeCloseTo(1, 10);
  });
  it('afviser ugyldige farver', () => {
    expect(() => contrastRatio('rød', '#fff')).toThrow();
  });
});

it('kan finde .navlink-farven i CSS', () => {
  expect(navlinkColor).toBeDefined();
});

describe('globals.css: mørk tilstand', () => {
  it('har samme variabler i media-query og data-theme', () => {
    expect(darkMedia).toEqual(darkAttr);
  });
});

const themes = { lys: light, mørk: dark } as const;
for (const [name, t] of Object.entries(themes)) {
  describe(`kontrast i ${name} tilstand`, () => {
    const pairs: Array<[string, string, string, number]> = [
      ['.navlink-tekst på --nav', navlinkColor!, t.nav, 4.5],
      ['.navlink-tekst på --nav-active', navlinkColor!, t['nav-active'], 4.5],
      ['hvid tekst på topbjælken', '#ffffff', t.topbar, 4.5],
      ['--muted på --card', t.muted, t.card, 4.5],
      ['--muted på --bg', t.muted, t.bg, 4.5],
      ['--text på --border (badge)', t.text, t.border, 4.5],
      ['--text på --card', t.text, t.card, 4.5],
      ['--heading på --card', t.heading, t.card, 4.5],
      ['--danger på --card', t.danger, t.card, 4.5],
      ['hvid tekst på --badge', '#ffffff', t.badge, 4.5],
      ['--badge som kant mod --card', t.badge, t.card, 3],
      ['--ok på --card', t.ok, t.card, 4.5],
      ['--maybe på --card', t.maybe, t.card, 4.5],
      ['--no på --card', t.no, t.card, 4.5],
      ['valgt tilmelding: tekst på --ok', t['on-status'], t.ok, 4.5],
      ['valgt tilmelding: tekst på --maybe', t['on-status'], t.maybe, 4.5],
      ['valgt tilmelding: tekst på --no', t['on-status'], t.no, 4.5],
      ['--ok-kant mod --card', t.ok, t.card, 3],
      ['--maybe-kant mod --card', t.maybe, t.card, 3],
      ['aflyst kort: --text på --bg', t.text, t.bg, 4.5],
      ['aflyst kort: --muted på --bg', t.muted, t.bg, 4.5],
      ['aflyst kort: --heading på --bg', t.heading, t.bg, 4.5],
      ['--ok på --bg (RSVP hover)', t.ok, t.bg, 4.5],
      ['--maybe på --bg (RSVP hover)', t.maybe, t.bg, 4.5],
      ['--no på --bg (RSVP hover)', t.no, t.bg, 4.5],
      ['--ok på --border', t.ok, t.border, 4.5],
      ['--maybe på --border', t.maybe, t.border, 4.5],
      ['--no på --border', t.no, t.border, 4.5],
      ['--focus mod --card', t.focus, t.card, 3],
      ['--focus mod --bg', t.focus, t.bg, 3],
      ['datoblok: --heading på --bg', t.heading, t.bg, 4.5],
      ['datoblok: --muted på --bg', t.muted, t.bg, 4.5],
      ['ikonknap og lukkeknap hover: --heading på --border', t.heading, t.border, 4.5],
      ['Opret-menu og lukkeknap hover: --text på --border', t.text, t.border, 4.5],
      ['notifikationsbånd: --text på --card', t.text, t.card, 4.5],
      ['notifikationsbånd: --heading på --card (link)', t.heading, t.card, 4.5],
      ['notifikationsbånd: --danger på --card (ikon)', t.danger, t.card, 3],
      ['notifikationsbånd: --badge som kant mod --card', t.badge, t.card, 3],
      ['fokusring (hvid) mod --nav', t['focus-inverse'], t.nav, 3],
      ['fokusring (hvid) mod topbjælken', t['focus-inverse'], t.topbar, 3],
    ];
    it.each(pairs)('%s', (_label, fg, bg, min) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  });
}
