import type { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { RetryAfterFilter } from './common/retry-after.filter.js';

/** Shared by main.ts and the e2e tests so both exercise the same HTTP surface. */
export function configureApp(app: INestApplication): INestApplication {
  // PH-8.1 (BL-012): standard security headers on every response, and no server fingerprint. The API serves
  // JSON and attachment bytes only, so helmet's defaults apply unchanged (CSP is meaningless for JSON).
  app.use(helmet());
  const instance = (app as NestExpressApplication).getHttpAdapter().getInstance();
  instance.disable('x-powered-by');
  // BL-026: which proxies in front of the API may report the client's address (`SUPPORT_TRUST_PROXY`); none by default.
  instance.set('trust proxy', trustProxySetting());
  // Every 429 carries `Retry-After` (BL-026).
  app.useGlobalFilters(new RetryAfterFilter(app.get(HttpAdapterHost).httpAdapter));
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

/**
 * How many reverse proxies that append the client's address to `X-Forwarded-For` stand in front of the web
 * (`SUPPORT_TRUST_PROXY`, BL-026, DEC-0038). Unset, 0 or anything invalid means none, and then no address identifies a
 * client: the web's own proxy (Next rewrites) neither adds the browser's address nor drops one the browser forged
 * (observed in PH-9.4), so only a deployment with such a proxy may turn this on — usually with 1.
 */
export function trustProxySetting(env: NodeJS.ProcessEnv = process.env): number | false {
  const raw = (env.SUPPORT_TRUST_PROXY ?? '').trim();
  if (raw === '' || /^(0|false|off)$/i.test(raw)) return false;
  const hops = Number(raw);
  if (Number.isInteger(hops) && hops >= 1 && hops <= 10) return hops;
  console.warn(`SUPPORT_TRUST_PROXY="${raw}" is not a number of proxies between 0 and 10; trusting none`);
  return false;
}
