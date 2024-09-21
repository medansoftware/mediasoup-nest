import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DEFAULT_VALIDATION_OPTIONS } from './app.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: false,
    httpsOptions:
      process.env.ENABLE_HTTPS === 'true'
        ? {
            key: await readFile(process.env.SSL_KEY_FILE),
            cert: await readFile(process.env.SSL_CERT_FILE),
          }
        : undefined,
  });

  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe(DEFAULT_VALIDATION_OPTIONS));

  // start app on port
  await app.listen(process.env.PORT);
}
bootstrap();
