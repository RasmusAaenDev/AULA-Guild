'use client';

import { useActionState } from 'react';
import { quickSimAction } from '@/app/(app)/sim/actions';
import type { FormState } from '@/app/(app)/chat/actions';
import { useHydrated } from '@/components/useHydrated';

/** To knapper ved en af brugerens egne karakterer: kør Patchwerk- eller Dungeon Slice-simulation direkte fra armory. */
export function QuickSim({ characterId }: { characterId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(quickSimAction, {});
  const hydrated = useHydrated();
  const off = !hydrated || pending;
  return (
    <form action={action} className="quick-sim">
      <input type="hidden" name="characterId" value={characterId} />
      <button type="submit" name="style" value="Patchwerk" className="btn secondary" disabled={off} title="Fra armory, uden talenter">Sim Patchwerk</button>
      <button type="submit" name="style" value="DungeonSlice" className="btn secondary" disabled={off} title="Fra armory, uden talenter">Sim Dungeon Slice</button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
