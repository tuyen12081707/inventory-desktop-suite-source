import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.use(helmet());
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        (origin === 'null' && allowedOrigins.includes('file://'));
      callback(allowed ? null : new Error('Origin is not allowed'), allowed);
    },
    credentials: false,
  };
  app.enableCors(corsOptions);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inventory API')
    .setDescription('API quản lý kho cho ứng dụng desktop')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`Inventory API listening on http://localhost:${env.PORT}`, 'Bootstrap');
}

void bootstrap();
