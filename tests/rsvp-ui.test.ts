import { describe, expect, it } from 'vitest';
import { statusClass } from '@/lib/rsvp-ui';

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
