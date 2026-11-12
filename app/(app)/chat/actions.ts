/** Fælles svar fra formular-actions (egne kanaler og simulatoren): en dansk fejltekst, eller at det lykkedes. */
export type FormState = { error?: string; sent?: boolean; notice?: string };
