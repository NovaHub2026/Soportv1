import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, finishApp } from './app.setup.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

async function bootstrap() {
  // Development default: persisted embedded database under apps/api/.data (gitignored).
  // Tests leave SUPPORT_DB_DIR unset and get an in-memory database; SUPPORT_DATABASE_URL selects a PostgreSQL server.
  process.env.SUPPORT_DB_DIR ??= '.data/pglite';
  const app = await finishApp(configureApp(await NestFactory.create(AppModule)));
  // 3001 by default: the Next.js dev server owns 3000 (docs/runbooks/VERIFICATION.md).
  // Loopback unless SUPPORT_BIND names another address; an empty value is the default, never "every interface"
  // (Cycle Audit 3). The identity is simulated and trusts request headers (DEC-0008), so any other bind is announced
  // loudly whatever NODE_ENV says — it is acceptable only on a private network whose published port is loopback
  // (docker/compose.yml publishes the web on 127.0.0.1 and keeps the API unpublished).
  const bind = (process.env.SUPPORT_BIND ?? '').trim() || '127.0.0.1';
  if (!LOOPBACK.has(bind)) {
    console.warn(
      `API bound to ${bind} with the SIMULATED identity: anyone who can reach this address can act as any customer or staff member (DEC-0008). Never publish this port.`,
    );
  }
  await app.listen(process.env.PORT ?? 3001, bind);
}
await bootstrap();
