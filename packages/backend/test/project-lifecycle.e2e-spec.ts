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
 * Project lifecycle E2E: create → list → get → update → add member → archive
 *
 * Requires real Postgres + Redis. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Project lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let ownerToken: string;
  let workspaceId: string;
  let projectId: string;

  const ownerFixture = createUserFixture({
    email: 'project-e2e-owner@test.com',
  });
  const memberFixture = createUserFixture({
    email: 'project-e2e-member@test.com',
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
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers owner and creates workspace', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(ownerFixture)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerFixture.email, password: ownerFixture.plainPassword })
      .expect(201);

    ownerToken = (loginRes.body as { accessToken: string }).accessToken;

    const wsRes = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Project E2E WS', slug: 'project-e2e-ws' })
      .expect(201);

    workspaceId = (wsRes.body as { id: string }).id;
    expect(workspaceId).toBeDefined();
  });

  it('POST /workspaces/:wsId/projects → creates project with key', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Jitre Core', key: 'CORE', description: 'Core features' })
      .expect(201);

    projectId = (res.body as { id: string }).id;
    expect((res.body as { key: string }).key).toBe('CORE');
  });

  it('GET /workspaces/:wsId/projects → lists projects', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(
      (res.body as Array<{ id: string }>).some((p) => p.id === projectId),
    ).toBe(true);
  });

  it('PATCH /projects/:id → updates project name', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Jitre Core v2' })
      .expect(200);

    expect((res.body as { name: string }).name).toBe('Jitre Core v2');
  });

  it('POST /projects/:id/members → adds member with MEMBER role', async () => {
    // Register + add member to workspace first
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(memberFixture)
      .expect(201);

    const memberLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: memberFixture.email,
        password: memberFixture.plainPassword,
      })
      .expect(201);

    const memberId = (memberLoginRes.body as { userId: string }).userId;

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: memberId, role: 'MEMBER' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId: memberId, role: 'MEMBER' })
      .expect(201);

    expect((res.body as { role: string }).role).toBe('MEMBER');
  });

  it('DELETE /projects/:id → archives project when no active tasks', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);
  });

  it('POST /projects → rejects duplicate key in same workspace', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Dup Key', key: 'DUP' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Dup Key 2', key: 'DUP' })
      .expect(409);
  });

  // Suppress unused variable warning
  void dataSource;
});
