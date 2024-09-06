import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DEFAULT_VALIDATION_OPTIONS } from './app.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: false,
  });

  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe(DEFAULT_VALIDATION_OPTIONS));

  // start app on port
  await app.listen(process.env.PORT);
}
bootstrap();
