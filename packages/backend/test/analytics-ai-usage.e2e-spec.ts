/**
 * Analytics AI Usage — E2E spec (deferred execution)
 *
 * Requires: Docker (PostgreSQL + Redis) + applied migrations + seeded AiUsageRecord rows.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * Deferred from Fase 8 apply — execute once Docker environment is available.
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe.skip('Analytics — AI Usage endpoints (E2E)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    // TODO: bootstrap app with TestingModule, run migrations, seed workspace + users + ai_usage_records
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /api/v1/analytics/workspace/ai-usage', () => {
    it('returns 200 for OWNER with time-series data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage')
        .query({ period: 'day', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('period');
        expect(res.body[0]).toHaveProperty('requests');
        expect(res.body[0]).toHaveProperty('costUsd');
        expect(res.body[0]).toHaveProperty('inputTokens');
        expect(res.body[0]).toHaveProperty('outputTokens');
      }
    });

    it('returns 400 for invalid date range', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage')
        .query({ period: 'day', from: '2026-05-31', to: '2026-05-01' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(400);
    });
  });

  describe('GET /api/v1/analytics/workspace/ai-usage/by-user', () => {
    it('returns 200 for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage/by-user')
        .query({ period: 'day', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 200 for OWNER', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage/by-user')
        .query({ period: 'day', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });
  });

  describe('GET /api/v1/analytics/workspace/ai-usage/by-operation', () => {
    it('returns 200 with operation breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage/by-operation')
        .query({ period: 'day', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/workspace/ai-usage/failure-rate', () => {
    it('returns 200 with failure rate per period', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage/failure-rate')
        .query({ period: 'day', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('period');
        expect(res.body[0]).toHaveProperty('failureRate');
        expect(res.body[0].failureRate).toBeGreaterThanOrEqual(0);
        expect(res.body[0].failureRate).toBeLessThanOrEqual(1);
      }
    });

    it('returns failureRate=0 for periods with no requests (gap-fill)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage/failure-rate')
        .query({ period: 'day', from: '2020-01-01', to: '2020-01-03' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);

      const allZero = res.body.every(
        (p: { failureRate: number }) => p.failureRate === 0,
      );
      expect(allZero).toBe(true);
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/workspace/ai-usage/failure-rate')
        .query({ period: 'day', from: '2026-05-01', to: '2026-05-31' })
        .expect(401);
    });
  });
});
