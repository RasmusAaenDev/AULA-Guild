import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(app)/actions', () => ({ refreshAccountCharactersAction: async () => {} }));
import { UNVERIFIED_HELP, VerifiedMark } from '@/components/VerifiedMark';
import { AccountRefreshForm } from '@/components/AccountRefreshForm';

describe('VerifiedMark', () => {
  it('verificeret: diskret flueben med skjult tekst', () => {
    const html = renderToStaticMarkup(createElement(VerifiedMark, { verified: true }));
    expect(html).toContain('class="verified-mark"');
    expect(html).toContain('<span class="sr-only">verificeret</span>');
    expect(html).not.toContain('ikke verificeret');
  });
  it('uverificeret: synlig tekst og forklaring om medlemskab/officer', () => {
    const html = renderToStaticMarkup(createElement(VerifiedMark, { verified: false }));
    expect(html).toContain('>ikke verificeret</span>');
    expect(UNVERIFIED_HELP).toMatch(/medlemskab/);
    expect(UNVERIFIED_HELP).toMatch(/officer/);
  });
});

describe('AccountRefreshForm', () => {
  it('er en almindelig formular med tilbage-sti og hjælpetekst om nyt Battle.net-login', () => {
    const html = renderToStaticMarkup(createElement(AccountRefreshForm, { back: '/ingen-adgang', id: 'h1' }));
    expect(html).toContain('<input type="hidden" name="back" value="/ingen-adgang"/>');
    expect(html).toContain('aria-describedby="h1"');
    expect(html).toContain('Opdatér mine karakterer');
    expect(html).toContain('Log ind med Battle.net igen for at opdatere');
  });
});
