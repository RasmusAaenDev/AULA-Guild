import { describe, expect, it } from 'vitest';
import { isAuthorizedCron } from '@/lib/cron-auth';

const secret = 'x'.repeat(20);

describe('isAuthorizedCron', () => {
  it('accepterer korrekt Bearer-token', () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
  });
  it.each([null, '', 'Bearer ', `Bearer ${secret}x`, `Basic ${secret}`, secret, 'Bearer short'])('afviser %j', (h) => {
    expect(isAuthorizedCron(h, secret)).toBe(false);
  });
});
