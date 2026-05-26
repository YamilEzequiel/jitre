import type { QueryRunner } from 'typeorm';
import { Fase8AnalyticsIndexes1700000000700 } from './1700000000700-Fase8AnalyticsIndexes';

describe('Fase8AnalyticsIndexes1700000000700', () => {
  let migration: Fase8AnalyticsIndexes1700000000700;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase8AnalyticsIndexes1700000000700();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates idx_audit_ws_action_time index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_audit_ws_action_time'))).toBe(
        true,
      );
    });

    it('creates idx_project_memberships_user_workspace index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('idx_project_memberships_user_workspace')),
      ).toBe(true);
    });

    it('audit index uses CREATE INDEX IF NOT EXISTS for idempotency', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_audit_ws_action_time'));
      expect(idx).toContain('IF NOT EXISTS');
    });

    it('membership index uses CREATE INDEX IF NOT EXISTS for idempotency', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) =>
        q.includes('idx_project_memberships_user_workspace'),
      );
      expect(idx).toContain('IF NOT EXISTS');
    });

    it('audit index targets audit_logs table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_audit_ws_action_time'));
      expect(idx).toContain('audit_logs');
    });

    it('audit index covers workspace_id, action, occurred_at', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_audit_ws_action_time'));
      expect(idx).toContain('workspace_id');
      expect(idx).toContain('action');
      expect(idx).toContain('occurred_at');
    });

    it('audit index is a partial index (WHERE deleted_at IS NULL)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_audit_ws_action_time'));
      expect(idx).toContain('deleted_at IS NULL');
    });

    it('membership index targets project_memberships table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) =>
        q.includes('idx_project_memberships_user_workspace'),
      );
      expect(idx).toContain('project_memberships');
    });

    it('re-running up() does not throw (idempotent)', async () => {
      await expect(
        migration.up(queryRunner as unknown as QueryRunner),
      ).resolves.not.toThrow();
      await expect(
        migration.up(queryRunner as unknown as QueryRunner),
      ).resolves.not.toThrow();
    });
  });

  describe('down()', () => {
    it('drops idx_audit_ws_action_time', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_audit_ws_action_time'))).toBe(
        true,
      );
    });

    it('drops idx_project_memberships_user_workspace', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('idx_project_memberships_user_workspace')),
      ).toBe(true);
    });

    it('uses DROP INDEX IF EXISTS for safety', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.every((q) => q.includes('IF EXISTS'))).toBe(true);
    });
  });
});
