import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve locally stored uploads when StorageService falls back to disk (dev).
  // With Supabase Storage configured, files are served from the CDN instead.
  const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
  app.useStaticAssets(join(process.cwd(), uploadDir), {
    prefix: `/${uploadDir}`,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
