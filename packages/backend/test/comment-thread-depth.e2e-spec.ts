import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

/**
 * Comment thread depth E2E.
 *
 * Requires real Postgres + migration:
 *   docker compose up -d && npm run db:migration:run -w @jitre/backend
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * @deferred — Docker/PG unavailable during batch 2.
 */
describe('Comment thread depth (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let workspaceId: string;

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

    const ts = Date.now();

    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `thread-depth-${ts}@test.com`,
        password: 'ValidPass1!',
        displayName: 'Thread Depth User',
        deviceInfo: {},
      })
      .expect(201);

    token = regRes.body.accessToken;
    workspaceId = regRes.body.workspace?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a root comment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body: 'Root comment',
      })
      .expect(201);

    expect(res.body.parentId).toBeNull();
  });

  it('creates a reply (depth 1) to a root comment', async () => {
    // Create root first
    const rootRes = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body: 'Root',
      })
      .expect(201);

    const replyRes = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body: 'Reply to root',
        parentId: rootRes.body.id,
      })
      .expect(201);

    expect(replyRes.body.parentId).toBe(rootRes.body.id);
  });

  it('rejects depth-2 reply (reply to a reply) — 400 MAX_THREAD_DEPTH', async () => {
    // Create root
    const rootRes = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body: 'Root',
      })
      .expect(201);

    // Create reply (depth 1)
    const replyRes = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body: 'Reply',
        parentId: rootRes.body.id,
      })
      .expect(201);

    // Try depth-2 reply → should fail
    await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body: 'Deep reply',
        parentId: replyRes.body.id,
      })
      .expect(400);
  });
});
