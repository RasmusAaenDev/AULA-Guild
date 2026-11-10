'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/(app)/kalender/actions';

/** Knap med bekræftelsesdialog; viser serverens fejlbesked. Serveren tjekker stadig rettigheder. */
export function ConfirmForm({
  action, fields, label, confirmText,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string | number>;
  label: string;
  confirmText: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className="btn danger" disabled={pending}>{pending ? 'Vent …' : label}</button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
