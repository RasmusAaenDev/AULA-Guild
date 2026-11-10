import { startTransition, useState } from 'react';

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

/**
 * onSubmit-handler i stedet for `<form action={…}>`: React 19 nulstiller ellers formularen automatisk efter en
 * handling, og en kontrolleret <select> hopper så tilbage til sin første option, mens state stadig husker valget.
 * Ingen af formularerne har navngivne submit-knapper; hvis en får det, skal `submitter` med i FormData.
 */
export function submitHandler(action: (formData: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => action(fd));
  };
}
