import type { INestApplication } from '@nestjs/common';

/** Shared by main.ts and the e2e tests so both exercise the same HTTP surface. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  app.enableShutdownHooks();
  return app;
}
