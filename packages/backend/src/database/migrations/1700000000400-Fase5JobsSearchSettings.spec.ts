import type { QueryRunner } from 'typeorm';
import { Fase5JobsSearchSettings1700000000400 } from './1700000000400-Fase5JobsSearchSettings';

describe('Fase5JobsSearchSettings1700000000400', () => {
  let migration: Fase5JobsSearchSettings1700000000400;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase5JobsSearchSettings1700000000400();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates job_logs table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "job_logs"'))).toBe(
        true,
      );
    });

    it('creates idx_jl_queue_status_time index on job_logs', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_jl_queue_status_time'))).toBe(
        true,
      );
    });

    it('creates search_documents table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "search_documents"')),
      ).toBe(true);
    });

    it('creates GIN index idx_sd_tsvector on search_documents', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_sd_tsvector'))).toBe(true);
      expect(calls.some((q) => q.includes('USING GIN'))).toBe(true);
    });

    it('creates unique partial index uq_sd_ws_type_entity on search_documents', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('uq_sd_ws_type_entity'))).toBe(true);
    });

    it('creates user_settings table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "user_settings"')),
      ).toBe(true);
    });

    it('creates workspace_settings table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "workspace_settings"')),
      ).toBe(true);
    });

    it('creates ai_settings table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "ai_settings"'))).toBe(
        true,
      );
    });

    it('creates notification_settings table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "notification_settings"')),
      ).toBe(true);
    });

    it('creates COALESCE partial unique index on notification_settings', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('uq_ns_user_ws_key'))).toBe(true);
      expect(calls.some((q) => q.includes('COALESCE'))).toBe(true);
    });

    it('adds FK constraints for all tables', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('fk_sd_ws'))).toBe(true);
      expect(calls.some((q) => q.includes('fk_us_user'))).toBe(true);
      expect(calls.some((q) => q.includes('fk_ws_ws'))).toBe(true);
      expect(calls.some((q) => q.includes('fk_ai_ws'))).toBe(true);
      expect(calls.some((q) => q.includes('fk_ns_user'))).toBe(true);
      expect(calls.some((q) => q.includes('fk_ns_ws'))).toBe(true);
    });
  });

  describe('down()', () => {
    it('drops all 6 tables in reverse FK order', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) =>
          q.includes('DROP TABLE IF EXISTS "notification_settings"'),
        ),
      ).toBe(true);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "ai_settings"')),
      ).toBe(true);
      expect(
        calls.some((q) =>
          q.includes('DROP TABLE IF EXISTS "workspace_settings"'),
        ),
      ).toBe(true);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "user_settings"')),
      ).toBe(true);
      expect(
        calls.some((q) =>
          q.includes('DROP TABLE IF EXISTS "search_documents"'),
        ),
      ).toBe(true);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "job_logs"')),
      ).toBe(true);
    });

    it('drops FK constraints before dropping tables', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fkNsWsIdx = calls.findIndex((q) => q.includes('fk_ns_ws'));
      const dropNsIdx = calls.findIndex((q) =>
        q.includes('DROP TABLE IF EXISTS "notification_settings"'),
      );
      expect(fkNsWsIdx).toBeLessThan(dropNsIdx);
    });
  });
});
