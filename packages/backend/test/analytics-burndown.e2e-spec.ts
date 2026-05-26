/**
 * Analytics Burndown — E2E spec (deferred execution)
 *
 * Requires: Docker (PostgreSQL + Redis) + applied migrations.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * Deferred from Fase 8 apply — execute once Docker environment is available.
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe.skip('Analytics — Burndown + Status-Flow endpoints (E2E)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    // TODO: bootstrap app with TestingModule, run migrations, seed workspace + project + tasks
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /api/v1/analytics/projects/:projectId/burndown', () => {
    it('returns 200 with burndown data array', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/burndown`)
        .query({ from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('date');
        expect(res.body[0]).toHaveProperty('remaining');
      }
    });

    it('returns one point per day covering the full range (gap-fill)', async () => {
      const from = '2026-05-01';
      const to = '2026-05-07';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/burndown`)
        .query({ from, to })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      // 7 days: May 1–7 inclusive
      expect(res.body.length).toBe(7);
    });

    it('returns 400 for range > 365 days', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/burndown`)
        .query({ from: '2025-01-01', to: '2026-01-02' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(400);
    });
  });

  describe('GET /api/v1/analytics/projects/:projectId/status-flow', () => {
    it('returns 200 with edges array', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/status-flow`)
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('does NOT set X-Analytics-Truncated header when under 1000 edges', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/status-flow`)
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(res.headers['x-analytics-truncated']).toBeUndefined();
    });
  });
});
