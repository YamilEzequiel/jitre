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
 * Audit controller E2E: MEMBER gets 403, ADMIN gets 200.
 *
 * Requires real Postgres. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Audit controller (e2e)', () => {
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

  describe('role-based access', () => {
    let adminToken: string;
    let memberToken: string;
    let workspaceId: string;

    beforeAll(async () => {
      const ts = Date.now();

      // Register ADMIN (owner)
      const adminRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `audit-admin-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Audit Admin',
          deviceInfo: {},
        })
        .expect(201);

      adminToken = (adminRes.body as { accessToken: string }).accessToken;

      const wsRes = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      workspaceId = (wsRes.body as { id: string }[])[0].id;

      // Register MEMBER
      const memberRegRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `audit-member-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Audit Member',
          deviceInfo: {},
        })
        .expect(201);

      const memberId = (memberRegRes.body as { user: { id: string } }).user.id;

      // Add member to workspace
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ userId: memberId, role: 'MEMBER' })
        .expect(201);

      // Login as member
      const memberLoginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `audit-member-${ts}@test.com`,
          password: 'ValidPass1!',
          deviceInfo: {},
        })
        .expect(201);

      memberToken = (memberLoginRes.body as { accessToken: string })
        .accessToken;
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('ADMIN gets 200 from GET /audit-logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      const body = res.body as { items: unknown[]; total: number };
      expect(body.items).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    it('MEMBER gets 403 from GET /audit-logs', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(403);
    });

    it('ADMIN gets 200 from subject-scoped GET /audit-logs/:type/:id', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs/Workspace/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });
  });
});
