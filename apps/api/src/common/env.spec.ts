import { describe, expect, it, vi } from 'vitest';
import { jobDisabled, MAX_TIMER_MS, positiveNumberEnv } from './env.js';

describe('environment numbers (FND-0014, FND-0031)', () => {
  it('accepts integers within the timer range and falls back otherwise, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(positiveNumberEnv('X', 60_000, { X: '2000' })).toBe(2000);
    expect(positiveNumberEnv('X', 60_000, { X: String(MAX_TIMER_MS) })).toBe(MAX_TIMER_MS);
    expect(positiveNumberEnv('X', 60_000, {})).toBe(60_000);
    expect(positiveNumberEnv('X', 60_000, { X: '  ' })).toBe(60_000);
    for (const bad of ['abc', '0', '-5', '0.5', 'NaN', 'Infinity', String(MAX_TIMER_MS + 1), '3600000000', '1e3.5']) {
      expect(positiveNumberEnv('X', 60_000, { X: bad })).toBe(60_000);
    }
    expect(warn).toHaveBeenCalledTimes(9);
    warn.mockRestore();
  });

  it('reads the off switch case-insensitively', () => {
    expect(jobDisabled('J', { J: 'off' })).toBe(true);
    expect(jobDisabled('J', { J: ' OFF ' })).toBe(true);
    expect(jobDisabled('J', { J: 'false' })).toBe(false);
    expect(jobDisabled('J', {})).toBe(false);
  });
});
