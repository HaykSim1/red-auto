import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const swaggerInProd = config.get<boolean>('SWAGGER_ENABLED') === true;
  const corsOrigins = config.get<string>('CORS_ORIGINS') ?? '*';

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  if (corsOrigins === '*') {
    app.enableCors({ origin: true, credentials: true });
  } else {
    const list = corsOrigins.split(',').map((o) => o.trim()).filter(Boolean);
    app.enableCors({ origin: list, credentials: true });
  }

  if (nodeEnv !== 'production' || swaggerInProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Zapchast API')
      .setDescription(
        'Request-based auto parts marketplace (MVP). All routes are under prefix /v1. Contract: repo docs/api.md.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      // Base URL must NOT include /v1: Nest already puts globalPrefix in each path (e.g. /v1/health).
      // If server were http://localhost:3000/v1, Swagger UI would call /v1/v1/health.
      .addServer(`http://localhost:${port}`, 'Local')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('swagger', app, document, {
      jsonDocumentUrl: 'swagger/json',
    });
  }

  await app.listen(port);
}
bootstrap();
