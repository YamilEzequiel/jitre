/**
 * Analytics RBAC — E2E spec (deferred execution)
 *
 * Covers: ability checks for read_workspace_analytics, read_project_analytics,
 * read_ai_analytics_by_user across workspace roles (OWNER, ADMIN, MEMBER, GUEST)
 * and project roles.
 *
 * Requires: Docker (PostgreSQL + Redis) + applied migrations.
 * Run: POSTGRES_DB=jitre_test NODE_ENV=test npm run test:e2e -w @jitre/backend
 *
 * Deferred from Fase 8 apply — execute once Docker environment is available.
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe.skip('Analytics — RBAC enforcement (E2E)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let guestToken: string;
  let nonMemberToken: string;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    // TODO: bootstrap app with TestingModule, run migrations, seed:
    //   - workspace with OWNER, ADMIN, MEMBER, GUEST roles
    //   - a project with projectId visible to MEMBER but NOT to nonMember
  });

  afterAll(async () => {
    await app?.close();
  });

  // ── Workspace analytics (read_workspace_analytics) ──────────────────────────

  describe('workspace velocity — read_workspace_analytics', () => {
    const PATH = '/api/v1/analytics/workspace/velocity';
    const QUERY = { period: 'week', from: '2026-05-01', to: '2026-05-31' };

    it('OWNER: 200', async () => {
      await request(app.getHttpServer())
        .get(PATH)
        .query(QUERY)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    it('ADMIN: 200', async () => {
      await request(app.getHttpServer())
        .get(PATH)
        .query(QUERY)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    it('MEMBER: 200 (filtered by own projects)', async () => {
      await request(app.getHttpServer())
        .get(PATH)
        .query(QUERY)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    it('GUEST: 200 (filtered by own projects)', async () => {
      await request(app.getHttpServer())
        .get(PATH)
        .query(QUERY)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });
  });

  // ── AI by-user (read_ai_analytics_by_user — ADMIN/OWNER only) ───────────────

  describe('ai-usage/by-user — read_ai_analytics_by_user', () => {
    const PATH = '/api/v1/analytics/workspace/ai-usage/by-user';
    const QUERY = { period: 'day', from: '2026-05-01', to: '2026-05-31' };

    it('OWNER: 200', async () => {
      await request(app.getHttpServer())
        .get(PATH)
        .query(QUERY)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    it('ADMIN: 200', async () => {
      await request(app.getHttpServer())
        .get(PATH)
        .query(QUERY)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    it('MEMBER: 403', async () => {
      await request(app.getHttpServer())
        .get(PATH)
        .query(QUERY)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(403);
    });
  });

  // ── Project analytics (read_project_analytics) ──────────────────────────────

  describe('project velocity — read_project_analytics', () => {
    it('project MEMBER: 200', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/velocity`)
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });

    it('non-project-member: 403', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/velocity`)
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(403);
    });

    it('workspace ADMIN (bypasses project membership): 200', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/analytics/projects/${projectId}/velocity`)
        .query({ period: 'week', from: '2026-05-01', to: '2026-05-31' })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
    });
  });
});
