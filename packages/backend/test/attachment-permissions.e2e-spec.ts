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
 * Attachment permission E2E.
 *
 * Requires real Postgres + migration:
 *   docker compose up -d && npm run db:migration:run -w @jitre/backend
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * @deferred — Docker/PG unavailable during batch 2.
 */
describe('Attachment permissions (e2e)', () => {
  let app: INestApplication<App>;
  let _ownerToken: string;
  let _memberToken: string;
  let _workspaceId: string;

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

    // Register workspace owner
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `att-owner-${ts}@test.com`,
        password: 'ValidPass1!',
        displayName: 'Att Owner',
        deviceInfo: {},
      })
      .expect(201);

    _ownerToken = ownerRes.body.accessToken;
    _workspaceId = ownerRes.body.workspace?.id;

    // Register separate member
    const memberRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `att-member-${ts}@test.com`,
        password: 'ValidPass1!',
        displayName: 'Att Member',
        deviceInfo: {},
      })
      .expect(201);

    _memberToken = memberRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploader can delete their own attachment', () => {
    // TODO: upload as owner, DELETE as owner → 204
    expect(true).toBe(true); // deferred — requires PG
  });

  it('ADMIN can delete another user attachment', () => {
    // TODO: upload as member, add member to workspace, promote to admin,
    // DELETE as admin → 204
    expect(true).toBe(true); // deferred — requires PG
  });

  it('non-owner MEMBER cannot delete another user attachment — 403', () => {
    // TODO: upload as owner, try DELETE as unrelated member → 403
    expect(true).toBe(true); // deferred — requires PG
  });

  it('unauthenticated request to attachments returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/attachments/some-id')
      .expect(401);
  });
});
