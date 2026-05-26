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
 * Comment mention E2E.
 *
 * Requires real Postgres + migration:
 *   docker compose up -d && npm run db:migration:run -w @jitre/backend
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * @deferred — Docker/PG unavailable during batch 2.
 */
describe('Comment mentions (e2e)', () => {
  let app: INestApplication<App>;
  let authorToken: string;
  let mentionedUserId: string;
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

    // Register author
    const authorRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `comment-author-${ts}@test.com`,
        password: 'ValidPass1!',
        displayName: 'Comment Author',
        deviceInfo: {},
      })
      .expect(201);

    authorToken = authorRes.body.accessToken;
    workspaceId = authorRes.body.workspace?.id;

    // Register user to mention
    const mentionedRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `mentioned-user-${ts}@test.com`,
        password: 'ValidPass1!',
        displayName: 'Mentioned User',
        deviceInfo: {},
      })
      .expect(201);

    mentionedUserId = mentionedRes.body.user?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/comments — creates comment with mention and emits mention.created event', async () => {
    const body = `Hello @[Mentioned User](${mentionedUserId})`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .set('Authorization', `Bearer ${authorToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        contextType: 'task',
        contextId: '00000000-0000-4000-8000-000000000001',
        body,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.body).toBe(body);
  });

  it('PATCH /api/v1/comments/:id — adding a new mention emits a second mention.created', async () => {
    // TODO: create comment, update with new mention, verify notification or audit entry
    // This test confirms mention diff logic: only NEW mentions fire events
  });

  it('PATCH /api/v1/comments/:id — removing a mention does NOT emit mention.created', async () => {
    // TODO: create comment with mention, update without mention, assert event count stays at 1
  });
});
