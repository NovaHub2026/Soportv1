import { describe, expect, it } from 'vitest';
import { clientBucket } from './client-bucket.js';

describe('clientBucket (BL-026, Cycle Audit 3 FND-0083)', () => {
  it('keys IPv4 by address, IPv4-mapped IPv6 by its IPv4 address, and IPv6 by its /64', () => {
    expect(clientBucket('203.0.113.7')).toBe('203.0.113.7');
    expect(clientBucket('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(clientBucket('2001:db8:1:1::1')).toBe('2001:0db8:0001:0001::/64');
    expect(clientBucket('2001:DB8:1:1::1e')).toBe(clientBucket('2001:db8:1:1::1'));
    expect(clientBucket('2001:db8:1:1:ffff:ffff:ffff:ffff')).toBe(clientBucket('2001:db8:1:1::1'));
    expect(clientBucket('2001:db8:1:2::1')).not.toBe(clientBucket('2001:db8:1:1::1'));
    expect(clientBucket('fe80::1%eth0')).toBe('fe80:0000:0000:0000::/64');
    expect(clientBucket('64:ff9b::192.0.2.33')).toBe('0064:ff9b:0000:0000::/64');
    expect(clientBucket('::1')).toBe('0000:0000:0000:0000::/64');
  });
});
