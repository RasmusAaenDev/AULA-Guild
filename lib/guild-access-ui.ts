// Ren logik for hvad gæster, medlemmer og officerer ser og må (ingen React, let at teste). Serveren håndhæver det samme
// med requireUser/requireGuildMember/requireOfficer; dette styrer kun, hvad der vises.

export type Viewer = { isGuildMember: boolean; isOfficer: boolean };

/** Hvor gæster sendes hen for at se, hvorfor de mangler adgang, og hvad de kan gøre ved det. */
export const NO_ACCESS_HREF = '/ingen-adgang';

/** Områder, der kræver en verificeret karakter i guilden (Skolehjem, Galleri, Filer). */
export const GUILD_ONLY_AREAS = ['/sim', '/galleri', '/filer'] as const;

export function isGuildOnlyArea(href: string): boolean {
  return (GUILD_ONLY_AREAS as readonly string[]).includes(href);
}

export type Permissions = {
  /** Opret opslag og begivenheder, kommentér, upload filer og billeder. */
  canCreate: boolean;
  canComment: boolean;
  /** Skolehjem (SimC), Galleri og Filer. */
  canUseGuildAreas: boolean;
  /** Tilmelding til events: alle indloggede. */
  canRsvp: boolean;
  /** Fastgøre, slette andres indhold, frakoble karakterer, gentagne events. */
  canModerate: boolean;
};

export function permissions(v: Viewer): Permissions {
  const member = v.isGuildMember;
  const officer = member && v.isOfficer;
  return { canCreate: member, canComment: member, canUseGuildAreas: member, canRsvp: true, canModerate: officer };
}

export type GuestStatus = {
  verified: number;
  verifiedInGuild: number;
  /** Uverificerede karakterer i guilden: de findes, men står ikke (endnu) på brugerens Battle.net-konto. */
  unverifiedInGuild: number;
};

export function guestStatus(chars: readonly { verified: boolean; inGuild: boolean }[]): GuestStatus {
  return {
    verified: chars.filter((c) => c.verified).length,
    verifiedInGuild: chars.filter((c) => c.verified && c.inGuild).length,
    unverifiedInGuild: chars.filter((c) => !c.verified && c.inGuild).length,
  };
}

/** «1 verificeret karakter» / «3 verificerede karakterer» / «ingen verificerede karakterer». */
export function verifiedCountLabel(n: number): string {
  if (n === 0) return 'ingen verificerede karakterer';
  return n === 1 ? '1 verificeret karakter' : `${n} verificerede karakterer`;
}
