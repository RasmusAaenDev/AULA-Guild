import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import BattleNet from 'next-auth/providers/battlenet';
import { applySignIn, revalidateToken, type BattleNetProfile } from '@/lib/auth-callbacks';
import { authDeps } from '@/lib/services';

// Adgang (medlem/officer) afledes af databasen og genberegnes jævnligt i jwt-callbacken, så sessionen kan være lang.
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    BattleNet({
      clientId: process.env.AUTH_BATTLENET_ID || process.env.BLIZZARD_CLIENT_ID,
      clientSecret: process.env.AUTH_BATTLENET_SECRET || process.env.BLIZZARD_CLIENT_SECRET,
      issuer: 'https://oauth.battle.net',
      authorization: { params: { scope: 'openid wow.profile' } },
      // Uden nonce afviser Auth.js Battle.nets ID-token («unexpected ID Token "nonce" claim value»).
      checks: ['pkce', 'state', 'nonce'],
    }),
  ],
  session: { strategy: 'jwt', maxAge: THIRTY_DAYS },
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
        // Brugerens access token bruges kun her (karaktersynk) og gemmes aldrig i tokenet.
        return applySignIn(authDeps(), token, {
          accessToken: account.access_token,
          profile: profile as BattleNetProfile,
        });
      }
      return revalidateToken(authDeps(), token);
    },
    async session({ session, token }) {
      // Session.user.id er number hos os, men AdapterUser.id er string, så skæringen bliver never.
      const t = token as JWT;
      const user = session.user as { id: number; isGuildMember: boolean; isOfficer: boolean; image: string | null };
      user.id = t.userId ?? 0;
      user.isGuildMember = t.isGuildMember === true;
      user.isOfficer = t.isOfficer === true;
      user.image = null;
      return session;
    },
  },
});
