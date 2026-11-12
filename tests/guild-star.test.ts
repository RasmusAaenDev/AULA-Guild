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
  it('viser kun stjerne ved guild-karakterer og annoncerer det én gang via knappens aria-label', () => {
    const html = renderToStaticMarkup(
      createElement(CharacterSwitcher, { characters: [c(1, 'Abe Aaen', true), c(2, 'Bob Bygger', false)], activeId: 1 }),
    );
    expect(html.match(/★/g)).toHaveLength(1);
    expect(html).not.toContain('role="img"');
    expect(html).toContain('aria-label="Abe Aaen (primær karakter), i guilden"');
    expect(html).toContain('aria-label="Skift primær karakter til Bob Bygger"');
  });
});
