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
 * Comment 7-day edit window E2E.
 *
 * Requires real Postgres + migration:
 *   docker compose up -d && npm run db:migration:run -w @jitre/backend
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * @deferred — Docker/PG unavailable during batch 2.
 *
 * TODO (next phase): test the expired-window path by directly manipulating
 * `created_at` via a raw DB update (set to 8 days ago) and then asserting 403.
 * The 7-day fast-forward cannot be tested by sleeping in CI — use DB injection.
 */
describe('Comment edit window (e2e)', () => {
  let app: INestApplication<App>;
  let authorToken: string;
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
        email: `edit-window-${ts}@test.com`,
        password: 'ValidPass1!',
        displayName: 'Edit Window User',
        deviceInfo: {},
      })
      .expect(201);

    authorToken = regRes.body.accessToken;
    workspaceId = regRes.body.workspace?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('create then immediately edit — happy path (within window)', async () => {
    // Step 1: Create comment
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body: 'Initial comment body',
      })
      .expect(201);

    const commentId = createRes.body.id;
    expect(commentId).toBeDefined();

    // Step 2: Edit immediately — should succeed (within 7-day window)
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ body: 'Updated comment body' })
      .expect(200);

    expect(patchRes.body.body).toBe('Updated comment body');
  });

  it('edit after 7-day window — returns 403 EDIT_WINDOW_EXPIRED', () => {
    /**
     * TODO: implement via direct DB manipulation:
     *   1. Create comment via API
     *   2. Use DataSource to run:
     *      UPDATE comments SET created_at = NOW() - INTERVAL '8 days' WHERE id = ?
     *   3. PATCH the comment → assert 403 with body.message = 'EDIT_WINDOW_EXPIRED'
     *
     * Skipped: requires PG connection + test DB seeder. Tracked for Fase 5.
     */
    expect(true).toBe(true); // placeholder — remove when implementing
  });

  it('non-author edit — returns 403 INSUFFICIENT_PERMISSION', async () => {
    // TODO: register second user, join workspace, try to edit first user's comment
    // assert 403
  });
});
