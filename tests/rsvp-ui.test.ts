import { describe, expect, it } from 'vitest';
import { rsvpStatuses, statusClass } from '@/lib/rsvp-ui';

import { rsvpStatuses as schemaStatuses } from '@/lib/db/schema';

describe('rsvpStatuses', () => {
  it('er den samme liste som schemaet bruger', () => {
    expect(rsvpStatuses).toEqual(['deltager', 'maaske', 'afbud']);
    expect(schemaStatuses).toBe(rsvpStatuses);
  });
});

describe('statusClass', () => {
  it('mapper hver status til sin klasse', () => {
    expect(statusClass('deltager')).toBe('status-deltager');
    expect(statusClass('maaske')).toBe('status-maaske');
    expect(statusClass('afbud')).toBe('status-afbud');
  });
  it('behandler ubesvaret som måske (stribet)', () => {
    expect(statusClass(null)).toBe('status-maaske');
  });
});
