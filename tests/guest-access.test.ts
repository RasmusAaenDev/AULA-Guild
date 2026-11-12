import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(app)/actions', () => ({ refreshAccountCharactersAction: async () => {} }));
import { GuestAccess } from '@/components/GuestAccess';
import { GuildOnlyHint } from '@/components/GuildOnlyHint';
import type { MyCharacter } from '@/lib/characters';

const ch = (id: number, verified: boolean, inGuild: boolean): MyCharacter => ({
  id, name: `C${id}`, fullName: `C${id} Navn`, className: 'Mage', spec: null, role: 'dps', inGuild, verified,
});
const guest = { isGuildMember: false, isOfficer: false };
const render = (viewer: typeof guest, characters: MyCharacter[]) => renderToStaticMarkup(createElement(GuestAccess, { viewer, characters }));

describe('GuestAccess', () => {
  it('gæst uden karakterer: forklaring, status og begge knapper', () => {
    const html = render(guest, []);
    expect(html).toContain('Du er ikke i guilden endnu');
    expect(html).toContain('ingen verificerede karakterer');
    expect(html).toContain('Ingen karakter i guilden.');
    expect(html).toContain('Opdatér mine karakterer');
    expect(html).toContain('value="/ingen-adgang"');
    expect(html).toContain('href="/karakter/ny"');
  });

  it('gæst med verificerede karakterer uden for guilden og en uverificeret i guilden', () => {
    const html = render(guest, [ch(1, true, false), ch(2, true, false), ch(3, false, true)]);
    expect(html).toContain('2 verificerede karakterer');
    expect(html).toContain('Ingen af dem er i guilden.');
    expect(html).toContain('1 karakter i guilden er tilføjet med navn');
    expect(html).toContain('ikke verificeret');
  });

  it('verificeret guild-karakter men gammel session: adgangen er på vej', () => {
    expect(render(guest, [ch(1, true, true)])).toContain('En af dem er i guilden');
  });

  it('medlem: kort besked og link til overblikket', () => {
    const html = render({ isGuildMember: true, isOfficer: false }, [ch(1, true, true)]);
    expect(html).toContain('Du er med i guilden');
    expect(html).not.toContain('Opdatér mine karakterer');
  });
});

describe('GuildOnlyHint', () => {
  it('siger «Kun for guildmedlemmer» og linker til gæstesiden', () => {
    const html = renderToStaticMarkup(createElement(GuildOnlyHint, { what: 'Opret' }));
    expect(html).toContain('Opret: kun for guildmedlemmer.');
    expect(html).toContain('href="/ingen-adgang"');
    expect(renderToStaticMarkup(createElement(GuildOnlyHint))).toContain('Kun for guildmedlemmer.');
  });
});
