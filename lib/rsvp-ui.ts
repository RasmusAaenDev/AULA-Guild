import type { RsvpStatus } from '@/lib/db/schema';

/** CSS-klasse til venstrekanten på et event-kort efter brugerens egen status (ubesvaret ligner «måske»). */
export function statusClass(status: RsvpStatus | null): 'status-deltager' | 'status-maaske' | 'status-afbud' {
  if (status === 'deltager') return 'status-deltager';
  if (status === 'afbud') return 'status-afbud';
  return 'status-maaske';
}
