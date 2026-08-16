import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Serve static assets from source (dev) or dist (prod)
  const staticDir = path.join(process.cwd(), 'src', 'modules', 'dashboard');
  app.useStaticAssets(staticDir, {
    prefix: '/dashboard/',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();