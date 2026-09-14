/**
 * Numeric configuration read from the environment with a validated fallback. `Number(undefined)` is `NaN`,
 * and a `NaN` interval makes Node fire timers every millisecond while rxjs stops them entirely — a misspelt
 * value must degrade to the default, never to a tight loop or a silent stop (Cycle Audit 1, FND-0014).
 * Node clamps timer delays outside [1, 2^31 - 1] to 1 ms as well, so the value must be an integer in that
 * range (Cycle Audit 2, FND-0031).
 */
export const MAX_TIMER_MS = 2_147_483_647;

export function positiveNumberEnv(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_TIMER_MS) return parsed;
  console.warn(`${name}="${raw}" is not an integer between 1 and ${MAX_TIMER_MS}; using ${fallback}`);
  return fallback;
}

/** `SUPPORT_<JOB>_JOB=off` (any case, surrounding spaces ignored) disables a background job. */
export function jobDisabled(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return (env[name] ?? '').trim().toLowerCase() === 'off';
}
