export type ArmoryCharacter = {
  blizzardId: number;
  slug: string;
  name: string;
  className: string;
  // string = udledt, null = opslag lykkedes men ingen enkelt spec, undefined = opslag fejlede (ukendt)
  spec?: string | null;
  itemLevel: number | null;
  guildId: number | null;
  guildName: string | null;
  lastLogin: Date | null;
};

export type RosterMember = { blizzardId: number; slug: string; name: string; rank: number };

export type BlizzardErrorKind = 'not_found' | 'rate_limited' | 'unavailable';

export class BlizzardError extends Error {
  constructor(public kind: BlizzardErrorKind, message: string) {
    super(message);
    this.name = 'BlizzardError';
  }
}

export type BlizzardClient = {
  getCharacter(slug: string): Promise<ArmoryCharacter>;
  getGuildRoster(guildSlug: string): Promise<RosterMember[]>;
};
