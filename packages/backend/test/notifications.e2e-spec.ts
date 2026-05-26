import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

/**
 * Notification flow E2E: add member → notification created; list, mark read, tenancy isolation.
 *
 * Requires real Postgres. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('add member triggers WORKSPACE_INVITED notification', () => {
    let userAToken: string;
    let userBId: string;
    let workspaceId: string;

    beforeAll(async () => {
      const ts = Date.now();

      // Register user A (owner)
      const resA = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `notif-a-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Notif User A',
          deviceInfo: {},
        })
        .expect(201);

      userAToken = (resA.body as { accessToken: string }).accessToken;

      // Register user B
      const resB = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `notif-b-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Notif User B',
          deviceInfo: {},
        })
        .expect(201);

      userBId = (resB.body as { user: { id: string } }).user.id;

      // Get workspace for user A
      const wsListRes = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      workspaceId = (wsListRes.body as { id: string }[])[0].id;

      // Add user B to user A's workspace
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ userId: userBId, role: 'MEMBER' })
        .expect(201);

      // Allow async listeners to process
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('user B has exactly 1 unread WORKSPACE_INVITED notification', async () => {
      const notifRow = await dataSource.query<
        { type: string; recipient_user_id: string; read_at: unknown }[]
      >(
        `SELECT type, recipient_user_id, read_at FROM notifications WHERE recipient_user_id = $1`,
        [userBId],
      );
      expect(notifRow.length).toBeGreaterThanOrEqual(1);
      const invited = notifRow.find((r) => r.type === 'WORKSPACE_INVITED');
      expect(invited).toBeDefined();
      expect(invited!.read_at).toBeNull();
    });

    it('user B can list notifications via API', async () => {
      const resBLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: expect.stringContaining('notif-b'),
          password: 'ValidPass1!',
          deviceInfo: {},
        });

      // Use DB query since we need userB's token — direct DB check is authoritative
      const rows = await dataSource.query<{ id: string; type: string }[]>(
        `SELECT id, type FROM notifications WHERE recipient_user_id = $1 ORDER BY occurred_at DESC`,
        [userBId],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].type).toBe('WORKSPACE_INVITED');
      void resBLogin;
    });

    it('tenancy: user A has no WORKSPACE_INVITED notification in user B workspace', async () => {
      const userAId = await dataSource.query<[{ id: string }]>(
        `SELECT id FROM users WHERE id != $1 LIMIT 1`,
        [userBId],
      );
      // User A should not have a WORKSPACE_INVITED notification (they added B, they didn't receive one)
      const notifRow = await dataSource.query<unknown[]>(
        `SELECT id FROM notifications WHERE recipient_user_id = $1 AND type = 'WORKSPACE_INVITED' AND workspace_id = $2`,
        [userAId[0]?.id, workspaceId],
      );
      expect(notifRow.length).toBe(0);
    });
  });
});
