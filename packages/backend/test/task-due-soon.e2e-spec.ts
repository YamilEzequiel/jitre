import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppModule } from '../src/app.module';
import { DueSoonScheduler } from '../src/task/schedulers/due-soon.scheduler';
import { createUserFixture } from './fixtures/users.fixture';

/**
 * Task due-soon E2E: create task due tomorrow → trigger scheduler → notification published
 *
 * Requires real Postgres + Redis. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Task due-soon scheduler (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let workspaceId: string;
  let projectId: string;
  let statusId: string;
  let scheduler: DueSoonScheduler;
  let emitter: EventEmitter2;

  const ownerFixture = createUserFixture({
    email: 'task-due-soon-e2e@test.com',
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
    scheduler = app.get(DueSoonScheduler);
    emitter = app.get(EventEmitter2);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates task due tomorrow and triggers DueSoonScheduler', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(ownerFixture)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerFixture.email, password: ownerFixture.plainPassword })
      .expect(201);

    ownerToken = (loginRes.body as { accessToken: string }).accessToken;
    const userId = (loginRes.body as { userId: string }).userId;

    const wsRes = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'DueSoon E2E WS', slug: 'due-soon-e2e-ws' })
      .expect(201);
    workspaceId = (wsRes.body as { id: string }).id;

    const projRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ name: 'Due Soon E2E', key: 'DSOON' })
      .expect(201);
    projectId = (projRes.body as { id: string }).id;

    const statusRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/statuses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);
    statusId = (statusRes.body as Array<{ id: string }>)[0]?.id ?? '';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const taskRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        title: 'Due soon task',
        statusId,
        dueDate: tomorrow.toISOString(),
      })
      .expect(201);

    const taskId = (taskRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ userId })
      .expect(201);

    const emittedEvents: unknown[] = [];
    emitter.on('task.due_soon', (event: unknown) => {
      emittedEvents.push(event);
    });

    await scheduler.run();

    expect(emittedEvents.length).toBeGreaterThanOrEqual(1);
    expect(
      (emittedEvents[0] as { payload: { taskId: string } }).payload.taskId,
    ).toBe(taskId);
  });

  it('scheduler respects notification.task_due_soon_window_days workspace setting', async () => {
    await request(app.getHttpServer())
      .put(
        `/api/v1/workspaces/${workspaceId}/settings/notification.task_due_soon_window_days`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ value: 0 })
      .expect(200);

    const emittedEvents: unknown[] = [];
    emitter.on('task.due_soon', (event: unknown) => {
      emittedEvents.push(event);
    });

    await scheduler.run();

    expect(emittedEvents.length).toBe(0);
  });
});
