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
 * Tenancy E2E:
 *   - userA accesses workspace W2 (not a member) → 403 TENANT_MISMATCH
 *   - Missing x-workspace-id on protected route → 400 WORKSPACE_HEADER_REQUIRED
 *   - Valid membership → 200
 */
describe('Tenancy interceptor (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let userAToken: string;
  let workspaceAId: string;
  let workspaceBId: string;
  let userBToken: string;

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

    const fixtureA = createUserFixture({
      email: 'tenant-a@example.com',
      displayName: 'Tenant A',
    });
    const fixtureB = createUserFixture({
      email: 'tenant-b@example.com',
      displayName: 'Tenant B',
    });

    // Register user A
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: fixtureA.email,
        password: fixtureA.plainPassword,
        displayName: fixtureA.displayName,
      })
      .expect(201);
    userAToken = regA.body.accessToken as string;

    // Register user B
    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: fixtureB.email,
        password: fixtureB.plainPassword,
        displayName: fixtureB.displayName,
      })
      .expect(201);
    userBToken = regB.body.accessToken as string;

    // List workspaces for A and B to get their workspace IDs
    const wsA = await request(app.getHttpServer())
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    workspaceAId = (wsA.body as Array<{ id: string }>)[0].id;

    const wsB = await request(app.getHttpServer())
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);
    workspaceBId = (wsB.body as Array<{ id: string }>)[0].id;
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE sessions, workspace_memberships, workspaces, users CASCADE',
    );
    await app.close();
  });

  it('protected route without x-workspace-id → 400 WORKSPACE_HEADER_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceAId}/members`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ userId: '00000000-0000-0000-0000-000000000001', role: 'MEMBER' })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/WORKSPACE_HEADER_REQUIRED/i);
  });

  it('user A accessing workspace B → 403 TENANT_MISMATCH', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceBId}/members`)
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-workspace-id', workspaceBId)
      .send({ userId: '00000000-0000-0000-0000-000000000001', role: 'MEMBER' })
      .expect(403);

    expect(JSON.stringify(res.body)).toMatch(/TENANT_MISMATCH/i);
  });

  it('GET /users/me without workspace header → 200 (SkipTenancy route)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
  });

  it('user A with valid x-workspace-id: workspaceA → request proceeds (list members)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceAId}/members`)
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-workspace-id', workspaceAId)
      .send({ userId: '00000000-0000-0000-0000-000000000001', role: 'MEMBER' })
      .expect((response) => {
        // 201 (success) or 404/409 (user not found, already member) are all fine
        // — the point is the tenancy check PASSED (not 400 or 403)
        expect([201, 404, 409]).toContain(response.status);
      });

    expect(res).toBeDefined();
  });
});
