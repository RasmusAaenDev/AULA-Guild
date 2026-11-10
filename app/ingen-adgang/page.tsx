import { signOut } from '@/auth';

export default function NoAccessPage() {
  return (
    <main className="center-card">
      <h1>Ingen adgang</h1>
      <p>Din Discord-konto er ikke medlem af guildens Discord-server. Bed en officer om en invitation, og log ind igen.</p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button type="submit" className="btn">Log ud</button>
      </form>
    </main>
  );
}
