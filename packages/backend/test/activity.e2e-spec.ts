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
 * Activity timeline E2E: paginated workspace activity, accessible by GUEST.
 *
 * Requires real Postgres. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Activity timeline (e2e)', () => {
  let app: INestApplication<App>;

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

  describe('ADMIN can see activity with pagination', () => {
    let accessToken: string;
    let workspaceId: string;

    beforeAll(async () => {
      const ts = Date.now();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `activity-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Activity User',
          deviceInfo: {},
        })
        .expect(201);

      accessToken = (res.body as { accessToken: string }).accessToken;

      const wsRes = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      workspaceId = (wsRes.body as { id: string }[])[0].id;

      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('returns paginated activity items in DESC order', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/activity')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      const body = res.body as {
        items: { occurredAt: string }[];
        total: number;
      };
      expect(body.items).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(1);

      if (body.items.length >= 2) {
        const first = new Date(body.items[0].occurredAt).getTime();
        const second = new Date(body.items[1].occurredAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('subject-scoped activity returns only matching rows', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/activity/Workspace/nonexistent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      const body = res.body as { items: unknown[]; total: number };
      expect(body.items).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe('MEMBER/GUEST can access activity (no ADMIN required)', () => {
    let ownerToken: string;
    let memberToken: string;
    let workspaceId: string;

    beforeAll(async () => {
      const ts = Date.now();

      const ownerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `activity-owner-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Activity Owner',
          deviceInfo: {},
        })
        .expect(201);

      ownerToken = (ownerRes.body as { accessToken: string }).accessToken;

      const memberRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `activity-member-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Activity Member',
          deviceInfo: {},
        })
        .expect(201);

      const memberId = (memberRes.body as { user: { id: string } }).user.id;

      const wsRes = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      workspaceId = (wsRes.body as { id: string }[])[0].id;

      // Add member
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ userId: memberId, role: 'MEMBER' })
        .expect(201);

      // Login as member
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `activity-member-${ts}@test.com`,
          password: 'ValidPass1!',
          deviceInfo: {},
        })
        .expect(201);

      memberToken = (loginRes.body as { accessToken: string }).accessToken;
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('MEMBER can GET /activity without 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/activity')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    void ownerToken; // suppress unused warning
  });
});
