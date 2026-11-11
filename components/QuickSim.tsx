'use client';

import { useActionState } from 'react';
import { quickSimAction } from '@/app/(app)/sim/actions';
import type { FormState } from '@/app/(app)/chat/actions';
import { Icon } from '@/components/icons';

/** To knapper ved en af brugerens egne karakterer: kør Patchwerk- eller Dungeon Slice-simulation direkte fra armory. */
export function QuickSim({ characterId }: { characterId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(quickSimAction, {});
  const off = pending;
  return (
    <form action={action} className="quick-sim" data-progressive>
      <input type="hidden" name="characterId" value={characterId} />
      <button type="submit" name="style" value="Patchwerk" className="btn secondary quick-sim-btn" disabled={off} aria-label="Sim Patchwerk: ét mål (fra armory, uden talenter)" title="Patchwerk: ét mål (fra armory, uden talenter)">
        <Icon name="person" size={22} />
      </button>
      <button type="submit" name="style" value="DungeonSlice" className="btn secondary quick-sim-btn" disabled={off} aria-label="Sim Dungeon Slice: gruppe af mål (fra armory, uden talenter)" title="Dungeon Slice: gruppe af mål (fra armory, uden talenter)">
        <Icon name="gruppe" size={22} />
      </button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
