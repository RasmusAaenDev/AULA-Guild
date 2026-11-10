import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: number; isMember: boolean; isOfficer: boolean } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: number;
    isMember?: boolean;
    isOfficer?: boolean;
  }
}
