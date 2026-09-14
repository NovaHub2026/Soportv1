import { Controller, Get } from '@nestjs/common';

export interface HealthReport {
  status: 'ok';
  database: string;
  identity: string;
  /** Which Orbit records adapter answers lookups (PH-4.1); simulation is never hidden. */
  orbitRecords: string;
  time: string;
}

@Controller('health')
export class AppController {
  /** Liveness plus an honest label of what backs this instance (simulation is never hidden — DEC-0003). */
  @Get()
  health(): HealthReport {
    return {
      status: 'ok',
      database: 'pglite (embedded PostgreSQL)',
      identity: 'simulated',
      orbitRecords: 'simulated',
      time: new Date().toISOString(),
    };
  }
}
