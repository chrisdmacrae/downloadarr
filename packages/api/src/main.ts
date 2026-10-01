import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { corsOrigins } from './common/utils/cors-origins';
import { API_PREFIX, serveUi } from './common/utils/serve-ui';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Exit on SIGTERM so `docker compose up` doesn't wait out the stop timeout
  // and SIGKILL us, and so onModuleDestroy hooks run.
  app.enableShutdownHooks();

  // The UI is served from this same origin and needs no CORS. This is for
  // other clients: the Vite dev server, TV apps, anything in CORS_ORIGINS.
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'cf-access-token'],
  });

  // Every route lives under /api/v1; everything else is the UI's.
  app.setGlobalPrefix(API_PREFIX);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Downloadarr API')
    .setDescription('All-in-one media and ROM downloading tool API')
    .setVersion('1.0')
    .addTag('downloads')
    .addTag('media')
    .addTag('roms')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // The built UI, from packages/ui/dist unless UI_DIST_PATH says otherwise.
  const uiDir = process.env.UI_DIST_PATH || join(__dirname, '..', '..', 'ui', 'dist');
  const servingUi = serveUi(app, uiDir);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Downloadarr is running on: http://localhost:${port}`);
  console.log(`🔌 API: http://localhost:${port}/${API_PREFIX}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  if (!servingUi) console.log(`ℹ️  No UI build at ${uiDir}; serving the API only`);
}

bootstrap();
