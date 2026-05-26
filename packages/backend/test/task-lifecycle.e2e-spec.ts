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
 * Task lifecycle E2E: create task → assign → change status → complete → reorder
 *
 * Requires real Postgres + Redis. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Task lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let workspaceId: string;
  let projectId: string;
  let todoStatusId: string;
  let doneStatusId: string;
  let taskId: string;

  const ownerFixture = createUserFixture({ email: 'task-e2e-owner@test.com' });

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

  it('setup: register + create workspace + project', async () => {
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
      .send({ name: 'Task E2E WS', slug: 'task-e2e-ws' })
      .expect(201);

    workspaceId = (wsRes.body as { id: string }).id;

    const projRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Task E2E Project', key: 'TSKE2E' })
      .expect(201);

    projectId = (projRes.body as { id: string }).id;
    expect(projectId).toBeDefined();
  });

  it('GET /projects/:id/statuses → lists 4 default statuses seeded on project create', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/statuses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    const statuses = res.body as Array<{ id: string; category: string }>;
    expect(statuses.length).toBeGreaterThanOrEqual(4);

    todoStatusId = statuses.find((s) => s.category === 'TODO')?.id ?? '';
    doneStatusId = statuses.find((s) => s.category === 'DONE')?.id ?? '';
    expect(todoStatusId).toBeTruthy();
    expect(doneStatusId).toBeTruthy();
  });

  it('POST /projects/:projectId/tasks → creates task with lexorank', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        title: 'First task',
        description: 'desc',
        statusId: todoStatusId,
        priority: 'MEDIUM',
      })
      .expect(201);

    taskId = (res.body as { id: string }).id;
    expect((res.body as { rank: string }).rank).toBeTruthy();
  });

  it('PATCH /projects/:projectId/tasks/:id/status → moves to DONE, sets completedAt', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ statusId: doneStatusId })
      .expect(200);

    expect(
      (res.body as { completedAt: string | null }).completedAt,
    ).not.toBeNull();
  });

  it('POST /projects/:projectId/tasks/:id/complete → complete via shortcut', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ title: 'Second task', statusId: todoStatusId })
      .expect(201);

    const secondTaskId = (createRes.body as { id: string }).id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks/${secondTaskId}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(
      (res.body as { completedAt: string | null }).completedAt,
    ).not.toBeNull();
  });

  it('DELETE /projects/:id → 409 when active tasks exist', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(409);
  });
});
