import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { createUserFixture } from './fixtures/users.fixture';

/**
 * Refresh token rotation E2E:
 *   - First refresh OK → T2 issued
 *   - Re-using T1 returns 401 TOKEN_REUSE
 */
describe('Refresh token rotation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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

    dataSource = app.get(DataSource);
    await dataSource.query(
      'TRUNCATE sessions, workspace_memberships, workspaces, users CASCADE',
    );
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE sessions, workspace_memberships, workspaces, users CASCADE',
    );
    await app.close();
  });

  const fixture = createUserFixture({
    email: 'rotation@example.com',
    displayName: 'Rotation User',
  });
  let refreshCookieT1: string;
  let csrfCookie: string;

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE sessions, workspace_memberships, workspaces, users CASCADE',
    );

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: fixture.email,
        password: fixture.plainPassword,
        displayName: fixture.displayName,
      })
      .expect(201);

    const cookies = reg.headers['set-cookie'] as string[];
    refreshCookieT1 = cookies.find((c: string) =>
      c.startsWith('refresh_token='),
    )!;
    csrfCookie = cookies.find((c: string) => c.startsWith('csrf_token='))!;
  });

  it('first refresh succeeds and returns T2', async () => {
    const csrfValue = csrfCookie.split(';')[0].replace('csrf_token=', '');

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookieT1, csrfCookie])
      .set('x-csrf-token', csrfValue)
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');

    const newCookies = res.headers['set-cookie'] as string[];
    const t2Cookie = newCookies.find((c: string) =>
      c.startsWith('refresh_token='),
    );
    expect(t2Cookie).toBeDefined();
  });

  it('reusing T1 after T2 was issued returns 401 TOKEN_REUSE', async () => {
    const csrfValue = csrfCookie.split(';')[0].replace('csrf_token=', '');

    // First call: T1 → T2
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookieT1, csrfCookie])
      .set('x-csrf-token', csrfValue)
      .expect(200);

    // Second call: T1 again → 401
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookieT1, csrfCookie])
      .set('x-csrf-token', csrfValue)
      .expect(401);

    expect(JSON.stringify(res.body)).toMatch(/TOKEN_REUSE/i);
  });
});
