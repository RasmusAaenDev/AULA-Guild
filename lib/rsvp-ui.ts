/** Statusværdier for tilmelding. Bor her (ikke i schema), så klientkomponenter kan bruge dem uden at hente drizzle ind. */
export const rsvpStatuses = ['deltager', 'maaske', 'afbud'] as const;
export type RsvpStatus = (typeof rsvpStatuses)[number];

/** CSS-klasse til venstrekanten på et event-kort efter brugerens egen status (ubesvaret ligner «måske»). */
export function statusClass(status: RsvpStatus | null): 'status-deltager' | 'status-maaske' | 'status-afbud' {
  if (status === 'deltager') return 'status-deltager';
  if (status === 'afbud') return 'status-afbud';
  return 'status-maaske';
}
