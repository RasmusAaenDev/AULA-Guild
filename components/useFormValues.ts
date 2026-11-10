import { useState } from 'react';

/**
 * Kontrollerede felter, så indtastet tekst overlever, at React 19 nulstiller formularen efter en serverhandling
 * (fx ved en valideringsfejl). Brug `bind('felt')` på input/select/textarea.
 */
export function useFormValues<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const bind = <K extends keyof T & string>(name: K) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  });
  return { values, setValues, bind };
}
