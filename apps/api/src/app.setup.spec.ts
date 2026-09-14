import { describe, expect, it } from 'vitest';
import { trustProxySetting } from './app.setup.js';

describe('trustProxySetting (BL-026, DEC-0038)', () => {
  it('trusts no proxy unless a deployment names how many appending proxies front the web', () => {
    expect(trustProxySetting({})).toBe(false);
    for (const off of ['', '  ', '0', 'false', 'OFF']) expect(trustProxySetting({ SUPPORT_TRUST_PROXY: off })).toBe(false);
    expect(trustProxySetting({ SUPPORT_TRUST_PROXY: '1' })).toBe(1);
    expect(trustProxySetting({ SUPPORT_TRUST_PROXY: ' 2 ' })).toBe(2);
    for (const bad of ['yes', '1.5', '-1', '11', 'loopback']) expect(trustProxySetting({ SUPPORT_TRUST_PROXY: bad })).toBe(false);
  });
});
