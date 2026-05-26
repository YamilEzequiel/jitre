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
 * Task search E2E: create task with labels → trigger re-indexing → search includes label names
 *
 * Requires real Postgres + Redis. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Task search (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let workspaceId: string;
  let projectId: string;
  let statusId: string;
  let labelId: string;
  let taskId: string;

  const ownerFixture = createUserFixture({ email: 'task-search-e2e@test.com' });

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

  it('setup: workspace + project + label + task', async () => {
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
      .send({ name: 'Search E2E WS', slug: 'search-e2e-ws' })
      .expect(201);
    workspaceId = (wsRes.body as { id: string }).id;

    const projRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Search E2E', key: 'SRCHE' })
      .expect(201);
    projectId = (projRes.body as { id: string }).id;

    const statusRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/statuses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);
    statusId = (statusRes.body as Array<{ id: string }>)[0]?.id ?? '';

    const labelRes = await request(app.getHttpServer())
      .post('/api/v1/labels')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'UniqueLabelXYZ123', scope: 'WORKSPACE', workspaceId })
      .expect(201);
    labelId = (labelRes.body as { id: string }).id;

    const taskRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ title: 'Searchable task', statusId })
      .expect(201);
    taskId = (taskRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks/${taskId}/labels`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ labelId })
      .expect(201);
  });

  it('GET /search?q=UniqueLabelXYZ123 → finds task by label name', async () => {
    // Allow time for async indexing job
    await new Promise<void>((r) => setTimeout(r, 500));

    const res = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'UniqueLabelXYZ123', workspaceId })
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    const results =
      (
        res.body as {
          results?: Array<{ entityType: string; entityId: string }>;
        }
      ).results ?? [];
    expect(
      results.some((r) => r.entityType === 'task' && r.entityId === taskId),
    ).toBe(true);
  });

  it('label.updated → re-indexes tasks with that label (fan-out ADR-D14)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/labels/${labelId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'RenamedLabelABC456' })
      .expect(200);

    await new Promise<void>((r) => setTimeout(r, 500));

    const res = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'RenamedLabelABC456', workspaceId })
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    const results =
      (
        res.body as {
          results?: Array<{ entityType: string; entityId: string }>;
        }
      ).results ?? [];
    expect(
      results.some((r) => r.entityType === 'task' && r.entityId === taskId),
    ).toBe(true);
  });
});
