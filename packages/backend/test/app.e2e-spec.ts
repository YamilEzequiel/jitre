import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Bootstrap smoke (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/healthz responds 200 with ok status and an x-request-id header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/healthz')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/healthz echoes a provided x-request-id', async () => {
    const reqId = 'test-corr-id-1234';
    const res = await request(app.getHttpServer())
      .get('/api/v1/healthz')
      .set('x-request-id', reqId)
      .expect(200);

    expect(res.headers['x-request-id']).toBe(reqId);
  });

  it('returns RFC 7807 problem JSON on unknown route', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__nope')
      .expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 404, title: expect.any(String) });
    expect(res.body.requestId).toBeDefined();
  });
});
