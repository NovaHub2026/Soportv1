import { Controller, Get } from '@nestjs/common';

export interface HealthReport {
  status: 'ok';
  database: string;
  identity: string;
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
      time: new Date().toISOString(),
    };
  }
}
