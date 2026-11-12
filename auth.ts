import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Discord from 'next-auth/providers/discord';
import { applySignIn, type DiscordProfile } from '@/lib/auth-callbacks';
import { createAccessRevalidator } from '@/lib/access-revalidate';
import { fetchMemberAccessByBot } from '@/lib/discord-access';
import { authDeps } from '@/lib/services';

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const TWELVE_HOURS = 60 * 60 * 12;

// En lang session (30 dage) kræver, at vi jævnligt kan tjekke guild-medlemskab og officer-rolle med bot-tokenet.
// Uden bot-token kan en fjernet spiller ikke afvises før sessionen udløber, så så er sessionen den korte på 12 timer.
const botToken = process.env.DISCORD_BOT_TOKEN?.trim() || '';
const revalidator = botToken
  ? createAccessRevalidator({
      lookup: (discordId) =>
        fetchMemberAccessByBot({
          botToken,
          guildId: process.env.DISCORD_GUILD_ID ?? '',
          officerRoleId: process.env.DISCORD_OFFICER_ROLE_ID ?? '',
          discordId,
        }),
    })
  : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      // Siden 14. oktober 2026 sender Discord `iss=https://discord.com` i svaret (RFC 9207). Uden en issuer
      // sammenligner Auth.js med pladsholderen https://authjs.dev og afviser alle logins.
      issuer: 'https://discord.com',
      authorization: { params: { scope: 'identify guilds.members.read' } },
    }),
  ],
  session: { strategy: 'jwt', maxAge: revalidator ? THIRTY_DAYS : TWELVE_HOURS },
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
        return applySignIn(authDeps(), token, {
          accessToken: account.access_token,
          profile: profile as unknown as DiscordProfile,
        });
      }
      // Eksisterende session: tjek medlemskab/officer-rolle mod Discord (cachet, fejl beholder den eksisterende adgang).
      const t = token as JWT;
      const discordId = typeof t.discordId === 'string' ? t.discordId : typeof t.sub === 'string' ? t.sub : null;
      if (revalidator && discordId && t.userId) {
        const fresh = await revalidator.check(discordId);
        if (fresh) return { ...token, isMember: fresh.isMember, isOfficer: fresh.isOfficer };
      }
      return token;
    },
    async session({ session, token }) {
      // Session.user.id er number hos os, men AdapterUser.id er string, så skæringen bliver never.
      const t = token as JWT;
      const user = session.user as { id: number; isMember: boolean; isOfficer: boolean };
      user.id = t.userId ?? 0;
      user.isMember = t.isMember === true;
      user.isOfficer = t.isOfficer === true;
      return session;
    },
  },
});
