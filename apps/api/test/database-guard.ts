// Loaded before every api test file (vitest `setupFiles`). The suites empty business tables between tests; with
// SUPPORT_DATABASE_URL set they would do that on the named PostgreSQL server — so only databases whose name ends
// in "_test" are accepted, whatever script started the run (`verify`, the gate, a developer shell). Cycle Audit 3.
const url = process.env.SUPPORT_DATABASE_URL?.trim();
if (url) {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run the api test suites against "${name}": SUPPORT_DATABASE_URL must name a database ending in _test (the tests delete rows).`);
  }
}

export {};
