import { Controller, Get, Inject } from '@nestjs/common';
import type { DatabaseHandle } from './database/database.js';
import { DB_HANDLE } from './database/database.module.js';
import { describeAdapters } from './identity/identity.module.js';

export interface HealthReport {
  status: 'ok';
  /** Which driver backs this instance: the embedded PGlite (development, demos) or a PostgreSQL server (PH-8.2). */
  database: string;
  identity: string;
  /** Which Orbit records adapter answers lookups (PH-4.1); simulation is never hidden. */
  orbitRecords: string;
  /** Which staff directory validates transfers (PH-13). */
  staffDirectory: string;
  time: string;
}

@Controller('health')
export class AppController {
  private readonly adapters = describeAdapters();

  constructor(@Inject(DB_HANDLE) private readonly database: DatabaseHandle) {}

  /** Liveness plus an honest label of what backs this instance (simulation is never hidden — DEC-0003). */
  @Get()
  health(): HealthReport {
    return {
      status: 'ok',
      database: this.database.driver === 'postgres' ? 'postgres (server)' : 'pglite (embedded PostgreSQL)',
      identity: this.adapters.identity,
      orbitRecords: this.adapters.orbitRecords,
      staffDirectory: this.adapters.staffDirectory,
      time: new Date().toISOString(),
    };
  }
}
