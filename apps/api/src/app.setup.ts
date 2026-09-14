import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import helmet from 'helmet';

/** Shared by main.ts and the e2e tests so both exercise the same HTTP surface. */
export function configureApp(app: INestApplication): INestApplication {
  // PH-8.1 (BL-012): standard security headers on every response, and no server fingerprint. The API serves
  // JSON and attachment bytes only, so helmet's defaults apply unchanged (CSP is meaningless for JSON).
  app.use(helmet());
  (app as NestExpressApplication).getHttpAdapter().getInstance().disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  app.enableShutdownHooks();
  return app;
}

/**
 * Initializes the application and registers the JSON "not found" fallback for paths outside the `/api` prefix,
 * which Express otherwise answers with an HTML page (Cycle Audit 1 FND-0025, PH-8.1 BL-012). Nest's own routes
 * already answer JSON 404s under the prefix. Must run after `configureApp`; `listen` may follow.
 */
export async function finishApp(app: INestApplication): Promise<INestApplication> {
  await app.init();
  (app as NestExpressApplication).getHttpAdapter().getInstance().use((req: Request, res: Response) => {
    res.status(404).json({ statusCode: 404, error: 'Not Found', message: `Cannot ${req.method} ${req.path}` });
  });
  return app;
}
