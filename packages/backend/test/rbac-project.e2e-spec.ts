import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { createUserFixture } from './fixtures/users.fixture';

/**
 * Project RBAC E2E: ADMIN can manage tasks/members, VIEWER read-only, non-member rejected.
 *
 * Requires real Postgres + Redis. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Project RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let workspaceId: string;
  let projectId: string;
  let statusId: string;
  let viewerUserId: string;

  const ownerFixture = createUserFixture({ email: 'rbac-proj-owner@test.com' });
  const viewerFixture = createUserFixture({
    email: 'rbac-proj-viewer@test.com',
  });
  const outsiderFixture = createUserFixture({
    email: 'rbac-proj-outsider@test.com',
  });

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('setup: owner creates workspace + project + adds viewer and outsider', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(ownerFixture)
      .expect(201);

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerFixture.email, password: ownerFixture.plainPassword })
      .expect(201);
    ownerToken = (ownerLogin.body as { accessToken: string }).accessToken;

    const wsRes = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'RBAC WS', slug: 'rbac-ws' })
      .expect(201);
    workspaceId = (wsRes.body as { id: string }).id;

    const projRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'RBAC Project', key: 'RBAC' })
      .expect(201);
    projectId = (projRes.body as { id: string }).id;

    const statusRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/statuses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);
    statusId = (statusRes.body as Array<{ id: string }>)[0]?.id ?? '';

    // Register viewer
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(viewerFixture)
      .expect(201);
    const viewerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: viewerFixture.email,
        password: viewerFixture.plainPassword,
      })
      .expect(201);
    viewerToken = (viewerLogin.body as { accessToken: string }).accessToken;
    viewerUserId = (viewerLogin.body as { userId: string }).userId;

    // Add viewer to workspace
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: viewerUserId, role: 'MEMBER' })
      .expect(201);

    // Add viewer to project as VIEWER
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: viewerUserId, role: 'VIEWER' })
      .expect(201);

    // Register outsider (workspace member but NOT project member)
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(outsiderFixture)
      .expect(201);
    const outsiderLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: outsiderFixture.email,
        password: outsiderFixture.plainPassword,
      })
      .expect(201);
    outsiderToken = (outsiderLogin.body as { accessToken: string }).accessToken;
    const outsiderId = (outsiderLogin.body as { userId: string }).userId;

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: outsiderId, role: 'MEMBER' })
      .expect(201);
  });

  it('VIEWER can GET /projects/:id', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);
  });

  it('VIEWER cannot POST /projects/:id/tasks (403)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ title: 'Viewer task', statusId })
      .expect(403);
  });

  it('non-member cannot GET /projects/:id (403)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(403);
  });

  it('ADMIN (owner) can create tasks', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ title: 'Admin task', statusId })
      .expect(201);
  });

  it('ADMIN can change member role from VIEWER to MEMBER', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/members/${viewerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ role: 'MEMBER' })
      .expect(200);
  });
});
