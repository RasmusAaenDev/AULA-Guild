import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(app)/actions', () => ({ setActiveAction: async () => {} }));
import { GuildStar } from '@/components/GuildStar';
import { CharacterSwitcher } from '@/components/CharacterSwitcher';
import type { MyCharacter } from '@/lib/characters';

const c = (id: number, fullName: string, inGuild: boolean): MyCharacter => ({
  id, name: fullName.split(' ')[0], fullName, className: 'Mage', spec: null, role: 'dps', inGuild,
});

describe('GuildStar', () => {
  it('annoncerer «I guilden» og indeholder ingen anden tekst end stjernen', () => {
    const html = renderToStaticMarkup(createElement(GuildStar));
    expect(html).toBe('<span class="guild-star" role="img" aria-label="I guilden" title="I guilden">★</span>');
  });
  it('er skjult for skærmlæsere som decorative', () => {
    expect(renderToStaticMarkup(createElement(GuildStar, { decorative: true }))).toBe('<span class="guild-star" aria-hidden="true">★</span>');
  });
});

describe('CharacterSwitcher', () => {
  it('viser ingen stjerne i topbaren, og knappens label nævner ikke guilden', () => {
    const html = renderToStaticMarkup(
      createElement(CharacterSwitcher, { characters: [c(1, 'Abe Aaen', true), c(2, 'Bob Bygger', false)], activeId: 1 }),
    );
    expect(html).not.toContain('★');
    expect(html).toContain('aria-label="Abe Aaen (primær karakter)"');
    expect(html).toContain('aria-label="Skift primær karakter til Bob Bygger"');
  });
});
