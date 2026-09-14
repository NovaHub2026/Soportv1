import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // Development default: persisted embedded database under apps/api/.data (gitignored).
  // Tests leave SUPPORT_DB_DIR unset and get an in-memory database.
  process.env.SUPPORT_DB_DIR ??= '.data/pglite';
  const app = configureApp(await NestFactory.create(AppModule));
  // 3001 by default: the Next.js dev server owns 3000 (docs/runbooks/VERIFICATION.md).
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
