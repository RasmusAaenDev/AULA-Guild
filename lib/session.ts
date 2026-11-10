import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export type Member = { userId: number; name: string; image: string | null; isOfficer: boolean };

export async function requireMember(): Promise<Member> {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.isMember || !session.user.id) redirect('/ingen-adgang');
  return {
    userId: session.user.id,
    name: session.user.name ?? 'Ukendt',
    image: session.user.image ?? null,
    isOfficer: session.user.isOfficer,
  };
}

export async function requireOfficer(): Promise<Member> {
  const member = await requireMember();
  if (!member.isOfficer) throw new Error('Forbidden');
  return member;
}
