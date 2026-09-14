import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, finishApp } from './app.setup.js';

async function bootstrap() {
  // Development default: persisted embedded database under apps/api/.data (gitignored).
  // Tests leave SUPPORT_DB_DIR unset and get an in-memory database.
  process.env.SUPPORT_DB_DIR ??= '.data/pglite';
  const app = await finishApp(configureApp(await NestFactory.create(AppModule)));
  // 3001 by default: the Next.js dev server owns 3000 (docs/runbooks/VERIFICATION.md).
  // Loopback by default (PH-8.1, BL-012): a deployment sets SUPPORT_BIND=0.0.0.0 behind its proxy and must also
  // set NODE_ENV=production so the simulated identity refuses to start (DEC-0008).
  const bind = process.env.SUPPORT_BIND ?? '127.0.0.1';
  const production = (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
  if (bind !== '127.0.0.1' && bind !== 'localhost' && !production) {
    console.warn(`API binds to ${bind} without NODE_ENV=production: the simulated identity trusts request headers — never expose this to a network`);
  }
  await app.listen(process.env.PORT ?? 3001, bind);
}
await bootstrap();
