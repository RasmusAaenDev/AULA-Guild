import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Discord from 'next-auth/providers/discord';
import { applySignIn, type DiscordProfile } from '@/lib/auth-callbacks';
import { authDeps } from '@/lib/services';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Discord({ authorization: { params: { scope: 'identify guilds.members.read' } } })],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
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
