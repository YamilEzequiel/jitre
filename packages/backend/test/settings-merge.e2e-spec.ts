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
 * Settings precedence E2E: set workspace-level and user-level notification settings,
 * then verify precedence resolution via GET /settings/me.
 *
 * Precedence chain (highest → lowest):
 *   per-user-per-workspace > per-user-global > workspace > default
 *
 * Requires real Postgres. Run with:
 *   POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 */
describe('Settings precedence (e2e)', () => {
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('per-workspace override beats user-global', () => {
    let ownerToken: string;
    let workspaceId: string;
    const ts = Date.now();

    beforeAll(async () => {
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `settings-owner-${ts}@test.com`,
          password: 'ValidPass1!',
          displayName: 'Settings Owner',
          deviceInfo: {},
        })
        .expect(201);

      ownerToken = (regRes.body as { accessToken: string }).accessToken;

      const wsRes = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      workspaceId = (wsRes.body as { id: string }[])[0].id;
    });

    it('default values resolve when no settings are stored', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/me?workspaceId=${workspaceId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const body = res.body as {
        notifications: { in_app: boolean; email: boolean };
      };
      expect(body.notifications.in_app).toBe(true);
      expect(body.notifications.email).toBe(true);
    });

    it('user-global overrides workspace default', async () => {
      // Set user-global email=false
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

      const body = res.body as { notifications: { email: boolean } };
      expect(body.notifications.email).toBe(false);
    });

    it('per-workspace-user setting overrides user-global', async () => {
      // Set per-workspace override email=true (reverses the user-global false)
      await request(app.getHttpServer())
        .patch('/api/v1/settings/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ key: 'notification.email', value: true, workspaceId })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/me?workspaceId=${workspaceId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const body = res.body as { notifications: { email: boolean } };
      expect(body.notifications.email).toBe(true);
    });

    it('unknown setting key returns 400', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/settings/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ key: 'user.banana', value: 'yellow' })
        .expect(400);
    });
  });
});
