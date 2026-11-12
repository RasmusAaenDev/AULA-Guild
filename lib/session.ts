import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export type Member = { userId: number; name: string; isGuildMember: boolean; isOfficer: boolean };

/** Enhver indlogget bruger (også gæster). Uden session: til /login. */
export async function requireUser(): Promise<Member> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return {
    userId: session.user.id,
    name: session.user.name ?? 'Ukendt',
    isGuildMember: session.user.isGuildMember === true,
    isOfficer: session.user.isOfficer === true,
  };
}

/** Kun brugere med en verificeret karakter i guilden. Gæster sendes til /ingen-adgang. */
export async function requireGuildMember(): Promise<Member> {
  const member = await requireUser();
  if (!member.isGuildMember) redirect('/ingen-adgang');
  return member;
}

/** Kun officerer; alle andre får en fejl (bruges af handlinger, ikke sider). */
export async function requireOfficer(): Promise<Member> {
  const member = await requireUser();
  if (!member.isOfficer) throw new Error('Forbidden');
  return member;
}
