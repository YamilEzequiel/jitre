/**
 * Analytics Velocity — E2E spec (deferred execution)
 *
 * Requires: Docker (PostgreSQL + Redis) + applied migrations.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * Deferred from Fase 8 apply — execute once Docker environment is available.
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe.skip('Analytics — Velocity endpoints (E2E)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let memberToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    // TODO: bootstrap app with TestingModule, run migrations, seed workspace + users
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /api/v1/analytics/workspace/velocity', () => {
    it('returns 200 with time-series array for OWNER', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/velocity')
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('period');
        expect(res.body[0]).toHaveProperty('value');
      }
    });

    it('returns 200 for MEMBER', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/velocity')
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    it('returns 400 for invalid date range (from > to)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/velocity')
        .query({ period: 'week', from: '2026-05-31', to: '2026-05-01' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(400);
    });

    it('returns 400 for range exceeding 365 days', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/velocity')
        .query({ period: 'day', from: '2025-01-01', to: '2026-01-02' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(400);
    });

    it('returns Cache-Control header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/velocity')
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(res.headers['cache-control']).toContain('max-age=300');
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/velocity')
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .expect(401);
    });
  });

  describe('GET /api/v1/analytics/projects/:projectId/velocity', () => {
    let projectId: string;

    it('returns 200 for project member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/velocity`)
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
