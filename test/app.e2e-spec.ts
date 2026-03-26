jest.mock('expo-server-sdk', () => ({
  Expo: class MockExpo {
    static isExpoPushToken(tok: unknown) {
      return typeof tok === 'string' && tok.length > 0;
    }
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    async sendPushNotificationsAsync() {
      return [];
    }
  },
}));

import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

function configureApp(app: INestApplication): void {
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
}

describe('Zapchast API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health returns ok', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok' });
      });
  });

  it('POST /v1/auth/otp/request rejects invalid phone', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone: '+19999999999' })
      .expect(400);
  });

  it('POST /v1/auth/otp/verify rejects bad code', async () => {
    const phone = '+37491123456';
    await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .send({ phone })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone, code: '000000' })
      .expect(401);
  });
});
