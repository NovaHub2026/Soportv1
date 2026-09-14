import { type DynamicModule, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabase, type DatabaseHandle } from './database.js';

export const DB = Symbol('DB');
export const DB_HANDLE = Symbol('DB_HANDLE');

export interface DatabaseModuleOptions {
  /** Directory for the persisted embedded database. Defaults to `SUPPORT_DB_DIR`; unset means in memory. */
  dataDir?: string;
  /** Force an in-memory database regardless of the environment (tests). */
  inMemory?: boolean;
}

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB_HANDLE) private readonly handle: DatabaseHandle) {}

  onApplicationShutdown(): Promise<void> {
    return this.handle.close();
  }
}

@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions = {}): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [
        {
          provide: DB_HANDLE,
          // Read the environment lazily (at bootstrap), not when the module is decorated.
          useFactory: () =>
            createDatabase(options.inMemory ? undefined : options.dataDir ?? process.env.SUPPORT_DB_DIR ?? undefined),
        },
        { provide: DB, useFactory: (handle: DatabaseHandle) => handle.db, inject: [DB_HANDLE] },
        DatabaseLifecycle,
      ],
      exports: [DB, DB_HANDLE],
    };
  }
}
