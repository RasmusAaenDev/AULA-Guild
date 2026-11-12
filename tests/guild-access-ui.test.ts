import { describe, expect, it } from 'vitest';
import { guestStatus, isGuildOnlyArea, permissions, verifiedCountLabel } from '@/lib/guild-access-ui';

const guest = { isGuildMember: false, isOfficer: false };
const memberV = { isGuildMember: true, isOfficer: false };
const officer = { isGuildMember: true, isOfficer: true };

describe('permissions', () => {
  it('gæst: må tilmelde sig, men ikke oprette, kommentere eller bruge guildens områder', () => {
    expect(permissions(guest)).toEqual({ canCreate: false, canComment: false, canUseGuildAreas: false, canRsvp: true, canModerate: false });
  });
  it('medlem: alt undtagen moderering', () => {
    expect(permissions(memberV)).toEqual({ canCreate: true, canComment: true, canUseGuildAreas: true, canRsvp: true, canModerate: false });
  });
  it('officer: også moderering', () => {
    expect(permissions(officer)).toEqual({ canCreate: true, canComment: true, canUseGuildAreas: true, canRsvp: true, canModerate: true });
  });
  it('officer-flag uden medlemskab giver ingen moderering (forsvar i dybden)', () => {
    expect(permissions({ isGuildMember: false, isOfficer: true }).canModerate).toBe(false);
  });
});

describe('isGuildOnlyArea', () => {
  it('Skolehjem, Galleri og Filer er lukkede for gæster; resten er åbne', () => {
    expect(['/sim', '/galleri', '/filer'].every(isGuildOnlyArea)).toBe(true);
    expect(['/', '/kalender', '/chat', '/kontakter'].some(isGuildOnlyArea)).toBe(false);
  });
});

describe('guestStatus', () => {
  it('tæller verificerede, verificerede i guilden og uverificerede i guilden', () => {
    expect(guestStatus([])).toEqual({ verified: 0, verifiedInGuild: 0, unverifiedInGuild: 0 });
    expect(
      guestStatus([
        { verified: true, inGuild: false },
        { verified: true, inGuild: true },
        { verified: false, inGuild: true },
        { verified: false, inGuild: false },
      ]),
    ).toEqual({ verified: 2, verifiedInGuild: 1, unverifiedInGuild: 1 });
  });
});

describe('verifiedCountLabel', () => {
  it('bøjer efter antal', () => {
    expect(verifiedCountLabel(0)).toBe('ingen verificerede karakterer');
    expect(verifiedCountLabel(1)).toBe('1 verificeret karakter');
    expect(verifiedCountLabel(3)).toBe('3 verificerede karakterer');
  });
});
