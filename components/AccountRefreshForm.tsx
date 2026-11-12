import { refreshAccountCharactersAction } from '@/app/(app)/actions';

/**
 * «Opdatér mine karakterer»: sender brugeren gennem Battle.net-login igen (tokenet gemmes ikke), så kontoens karakterer
 * hentes og verificeres. Almindelig `<form action>`, virker uden JavaScript.
 */
export function AccountRefreshForm({ back, id = 'account-refresh-help', primary = false }: { back: string; id?: string; primary?: boolean }) {
  return (
    <form action={refreshAccountCharactersAction} className="account-refresh">
      <input type="hidden" name="back" value={back} />
      <button type="submit" className={primary ? 'btn' : 'btn secondary'} aria-describedby={id}>
        Opdatér mine karakterer
      </button>
      <p id={id} className="muted">Log ind med Battle.net igen for at opdatere. Karaktererne på din konto hentes og bliver verificeret.</p>
    </form>
  );
}
