import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from '@/lib/contrast';
import { classKeys } from '@/lib/character-switcher';

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
      ['guild-stjerne: --star på --card', t.star, t.card, 4.5],
      ['guild-stjerne: --star på --bg', t.star, t.bg, 4.5],
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
      ['Skolehjem: fremdriftsbjælke --bar mod --border (sporet)', t.bar, t.border, 3],
      ['Skolehjem: fremdriftsbjælke --bar mod --card', t.bar, t.card, 3],
      ['Skolehjem: trin-cirkel --card på --heading', t.card, t.heading, 4.5],
      ['Skolehjem: --ok på --bg (bedste opgradering)', t.ok, t.bg, 4.5],
      ['Skolehjem: --no på --bg (nedgradering i fremhævet række)', t.no, t.bg, 4.5],
      ['fokusring (hvid) mod --nav', t['focus-inverse'], t.nav, 3],
      ['fokusring (hvid) mod topbjælken', t['focus-inverse'], t.topbar, 3],
    ];
    pairs.push(
      ['satire: --text på --sat-bg', t.text, t['sat-bg'], 4.5],
      ['satire: --heading på --sat-bg', t.heading, t['sat-bg'], 4.5],
      ['satire: --muted på --sat-bg', t.muted, t['sat-bg'], 4.5],
      ['satire: --sat-ink (etiket) på --sat-bg', t['sat-ink'], t['sat-bg'], 4.5],
      ['satire: stiplet kant mod --bg', t['sat-border'], t.bg, 3],
      ['satire: stiplet kant mod --sat-bg', t['sat-border'], t['sat-bg'], 3],
      ['satire-kommentar: --text på --card (boble)', t.text, t.card, 4.5],
      ['satire-kommentar: navn --sat-ink på --card', t['sat-ink'], t.card, 4.5],
      ['satire-kommentar: «Vis flere» --heading på --sat-bg', t.heading, t['sat-bg'], 4.5],
      ['satire-kommentar: venstre kant mod --card', t['sat-border'], t.card, 3],
    );
    for (const bg of ['chat-bubble', 'chat-mine'] as const) {
      pairs.push(
        [`chat: --text på --${bg}`, t.text, t[bg], 4.5],
        [`chat: afsender/link --heading på --${bg}`, t.heading, t[bg], 4.5],
        [`chat: tidspunkt --muted på --${bg}`, t.muted, t[bg], 4.5],
        [`chat: «Slet» --danger på --${bg}`, t.danger, t[bg], 4.5],
        [`chat: bot-badge --text på --border (i --${bg})`, t.text, t.border, 4.5],
      );
    }
    pairs.push(
      ['chat: valgt kanal (hvid) på --nav-active', '#ffffff', t['nav-active'], 4.5],
      ['chat: kanalikon --heading på --bg', t.heading, t.bg, 4.5],
      ['chat: mobil-kanalpille --text på --bg', t.text, t.bg, 4.5],
      ['chat: skrivefelt-kant --muted mod --card', t.muted, t.card, 3],
      ['chat: pladsholder --muted på --bg', t.muted, t.bg, 4.5],
      ['chat: send-knap (hvid) på --topbar', '#ffffff', t.topbar, 4.5],
    );
    for (let i = 0; i < 6; i++) {
      pairs.push([`satire-kommentar: initial (--sat-av-fg) på --sat-av-${i}`, t['sat-av-fg'], t[`sat-av-${i}`], 4.5]);
    }
    const clsKeys = [...classKeys, 'ukendt'];
    for (const k of clsKeys) {
      pairs.push(
        [`karakterskifter: initialer (--on-cls) på --cls-${k}`, t['on-cls'], t[`cls-${k}`], 4.5],
        [`karakterskifter: avatar --cls-${k} mod hvid ring`, t['focus-inverse'], t[`cls-${k}`], 3],
        [`karakterskifter: flueben-cirkel mod avatar --cls-${k}`, t['check-bg'], t[`cls-${k}`], 3],
      );
    }
    pairs.push(
      ['karakterskifter: flueben (--check-fg) på --check-bg', t['check-fg'], t['check-bg'], 4.5],
      ['karakterskifter: flueben-cirkel (--check-bg) mod topbjælken', t['check-bg'], t.topbar, 3],
      ['karakterskifter: «Tilføj karakter» (hvid) på topbjælken', '#ffffff', t.topbar, 4.5],
    );
    it.each(pairs)('%s', (_label, fg, bg, min) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  });
}
