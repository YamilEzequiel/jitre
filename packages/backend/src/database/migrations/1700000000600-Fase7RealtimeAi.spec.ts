import type { QueryRunner } from 'typeorm';
import { Fase7RealtimeAi1700000000600 } from './1700000000600-Fase7RealtimeAi';

describe('Fase7RealtimeAi1700000000600', () => {
  let migration: Fase7RealtimeAi1700000000600;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase7RealtimeAi1700000000600();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates ai_usage_records table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "ai_usage_records"')),
      ).toBe(true);
    });

    it('table includes workspace_id column', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const createCall = calls.find((q) =>
        q.includes('CREATE TABLE "ai_usage_records"'),
      );
      expect(createCall).toContain('workspace_id');
    });

    it('table includes user_id column', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const createCall = calls.find((q) =>
        q.includes('CREATE TABLE "ai_usage_records"'),
      );
      expect(createCall).toContain('user_id');
    });

    it('table includes cost_usd as numeric(12,6)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const createCall = calls.find((q) =>
        q.includes('CREATE TABLE "ai_usage_records"'),
      );
      expect(createCall).toMatch(/numeric\s*\(\s*12\s*,\s*6\s*\)/);
    });

    it('creates 3 partial indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const indexCalls = calls.filter(
        (q) => q.includes('CREATE INDEX') && q.includes('ai_usage'),
      );
      expect(indexCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('creates idx_ai_usage_ws_time index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_ai_usage_ws_time'))).toBe(true);
    });

    it('creates idx_ai_usage_ws_user_time index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_ai_usage_ws_user_time'))).toBe(
        true,
      );
    });

    it('creates idx_ai_usage_ws_op_time index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_ai_usage_ws_op_time'))).toBe(
        true,
      );
    });

    it('partial indexes have WHERE deleted_at IS NULL', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const indexCalls = calls.filter(
        (q) => q.includes('CREATE INDEX') && q.includes('ai_usage'),
      );
      expect(indexCalls.every((q) => q.includes('deleted_at IS NULL'))).toBe(
        true,
      );
    });

    it('creates FK from workspace_id to workspaces with ON DELETE CASCADE', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (q) => q.includes('fk_ai_usage_workspace') && q.includes('CASCADE'),
        ),
      ).toBe(true);
    });

    it('creates FK from user_id to users with ON DELETE SET NULL', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (q) => q.includes('fk_ai_usage_user') && q.includes('SET NULL'),
        ),
      ).toBe(true);
    });
  });

  describe('down()', () => {
    it('drops fk_ai_usage_user before dropping the table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fkIdx = calls.findIndex((q) => q.includes('fk_ai_usage_user'));
      const dropIdx = calls.findIndex((q) => q.includes('DROP TABLE'));
      expect(fkIdx).toBeGreaterThanOrEqual(0);
      expect(dropIdx).toBeGreaterThan(fkIdx);
    });

    it('drops ai_usage_records table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (q) => q.includes('DROP TABLE') && q.includes('ai_usage_records'),
        ),
      ).toBe(true);
    });

    it('drops indexes before table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const dropIdxIdx = calls.findIndex((q) => q.includes('DROP INDEX'));
      const dropTableIdx = calls.findIndex((q) => q.includes('DROP TABLE'));
      expect(dropIdxIdx).toBeGreaterThanOrEqual(0);
      expect(dropTableIdx).toBeGreaterThan(dropIdxIdx);
    });
  });
});
