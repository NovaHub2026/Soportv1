import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('reports liveness and labels the simulated backing honestly', () => {
    const report = new AppController().health();
    expect(report.status).toBe('ok');
    expect(report.identity).toBe('simulated');
    expect(report.database).toContain('pglite');
    expect(() => new Date(report.time).toISOString()).not.toThrow();
  });
});
