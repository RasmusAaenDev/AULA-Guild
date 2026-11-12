import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: number; isGuildMember: boolean; isOfficer: boolean } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: number;
    battlenetId?: string;
    isGuildMember?: boolean;
    isOfficer?: boolean;
    checkedAt?: number;
  }
}
