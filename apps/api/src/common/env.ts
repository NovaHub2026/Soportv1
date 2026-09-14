/**
 * Numeric configuration read from the environment with a validated fallback. `Number(undefined)` is `NaN`,
 * and a `NaN` interval makes Node fire timers every millisecond while rxjs stops them entirely — a misspelt
 * value must degrade to the default, never to a tight loop or a silent stop (Cycle Audit 1, FND-0014).
 */
export function positiveNumberEnv(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  console.warn(`${name}="${raw}" is not a positive number; using ${fallback}`);
  return fallback;
}
