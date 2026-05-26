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
 * CSRF double-submit E2E:
 *   - Missing csrf_token cookie → 403 CSRF_MISSING
 *   - Mismatched x-csrf-token header → 403 CSRF_MISMATCH
 *   - Matching csrf → 200
 */
describe('CSRF guard (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let refreshCookie: string;
  let csrfCookie: string;

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

    const fixture = createUserFixture({
      email: 'csrf@example.com',
      displayName: 'CSRF User',
    });
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: fixture.email,
        password: fixture.plainPassword,
        displayName: fixture.displayName,
      })
      .expect(201);

    const cookies = reg.headers['set-cookie'] as string[];
    refreshCookie = cookies.find((c: string) =>
      c.startsWith('refresh_token='),
    )!;
    csrfCookie = cookies.find((c: string) => c.startsWith('csrf_token='))!;
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE sessions, workspace_memberships, workspaces, users CASCADE',
    );
    await app.close();
  });

  it('POST /auth/refresh without csrf_token cookie → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie])
      .set('x-csrf-token', 'anything')
      .expect(403);

    expect(JSON.stringify(res.body)).toMatch(/CSRF_MISSING|CSRF_MISMATCH/i);
  });

  it('POST /auth/refresh with mismatched csrf → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie, csrfCookie])
      .set('x-csrf-token', 'wrong-csrf-value-abc123')
      .expect(403);

    expect(JSON.stringify(res.body)).toMatch(/CSRF_MISMATCH/i);
  });

  it('POST /auth/refresh with matching csrf → 200', async () => {
    const csrfValue = csrfCookie.split(';')[0].replace('csrf_token=', '');

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie, csrfCookie])
      .set('x-csrf-token', csrfValue)
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
  });
});
