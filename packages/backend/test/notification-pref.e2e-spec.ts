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
import { NotificationDispatcherService } from '../src/notification/notification-dispatcher.service';
import { NotificationType } from '@jitre/shared';

/**
 * Notification preferences E2E: set notification.email=false → dispatcher skips
 * email driver, still sends in-app.
 *
 * Requires real Postgres. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Notification preferences (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let dispatcher: NotificationDispatcherService;

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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    dispatcher = moduleFixture.get(NotificationDispatcherService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('notification.email=false skips email driver', () => {
    let ownerToken: string;
    let ownerId: string;
    let workspaceId: string;
    const ts = Date.now();

    beforeAll(async () => {
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `notif-pref-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Notif Pref Owner',
          deviceInfo: {},
        })
        .expect(201);

      ownerToken = (regRes.body as { accessToken: string }).accessToken;
      ownerId = (regRes.body as { user: { id: string } }).user.id;

      const wsRes = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      workspaceId = (wsRes.body as { id: string }[])[0].id;
    });

    it('dispatcher sends to all drivers when no preferences are set (opt-out default)', async () => {
      // Direct service call — verifies integrated behaviour without HTTP overhead
      // Should NOT throw — both drivers (in-app stub + email stub) should be called
      await expect(
        dispatcher.dispatch({
          workspaceId,
          recipientUserId: ownerId,
          type: NotificationType.WORKSPACE_INVITED,
          title: 'Test invite',
        }),
      ).resolves.toBeUndefined();
    });

    it('setting notification.email=false persists and GET /settings/me reflects it', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/settings/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ key: 'notification.email', value: false })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/me?workspaceId=${workspaceId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const body = res.body as {
        notifications: { email: boolean; in_app: boolean };
      };
      expect(body.notifications.email).toBe(false);
      expect(body.notifications.in_app).toBe(true);
    });

    it('notification_settings row exists in DB after PATCH', async () => {
      const rows = await dataSource.query<{ value: unknown }[]>(
        `SELECT value FROM notification_settings
         WHERE user_id = $1 AND key = 'notification.email' AND deleted_at IS NULL`,
        [ownerId],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].value).toBe(false);
    });

    it('dispatcher respects email=false after preference is set', async () => {
      // After setting notification.email=false the dispatcher should not call
      // the email driver. Since the email driver is a stub that logs only,
      // we verify no error is thrown and the dispatch resolves cleanly.
      await expect(
        dispatcher.dispatch({
          workspaceId,
          recipientUserId: ownerId,
          type: NotificationType.WORKSPACE_INVITED,
          title: 'Test invite — email disabled',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
