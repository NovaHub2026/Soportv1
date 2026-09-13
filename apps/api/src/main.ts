import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 3001 by default: the Next.js dev server owns 3000 (docs/runbooks/VERIFICATION.md).
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
