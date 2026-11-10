'use client';

import { useActionState } from 'react';
import type { RefreshState } from '@/lib/refresh';
import { refreshArmoryAction } from './refresh-actions';

/** «Opdater fra armory»: henter alle karakterer nu i stedet for at vente på den timevise opdatering. */
export function RefreshButton() {
  const [state, action, pending] = useActionState<RefreshState, FormData>((prev) => refreshArmoryAction(prev), {});
  return (
    <form action={action} className="refresh-form">
      <button type="submit" className="btn secondary" disabled={pending}>
        {pending ? 'Henter fra armory …' : 'Opdater fra armory'}
      </button>
      {state.message && <p role="status" className="muted">{state.message}</p>}
      {state.error && <p role="alert" className="error">{state.error}</p>}
    </form>
  );
}
