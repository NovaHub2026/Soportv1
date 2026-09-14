import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('reports liveness and labels the simulated backing honestly', () => {
    const handle = { driver: 'pglite' as const, db: {} as never, close: async () => undefined };
    const report = new AppController(handle).health();
    expect(report.status).toBe('ok');
    expect(report.identity).toBe('simulated');
    expect(report.database).toContain('pglite');
    // PH-8.2: a server-backed instance says so, never 'pglite'.
    expect(new AppController({ ...handle, driver: 'postgres' }).health().database).toContain('postgres (server)');
    expect(() => new Date(report.time).toISOString()).not.toThrow();
  });
});
