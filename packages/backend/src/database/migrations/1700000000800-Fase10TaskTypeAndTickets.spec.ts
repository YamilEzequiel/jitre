import type { QueryRunner } from 'typeorm';
import { Fase10TaskTypeAndTickets1700000000800 } from './1700000000800-Fase10TaskTypeAndTickets';

describe('Fase10TaskTypeAndTickets1700000000800', () => {
  let migration: Fase10TaskTypeAndTickets1700000000800;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase10TaskTypeAndTickets1700000000800();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('adds the type column to tasks', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find((q) => q.includes('ADD COLUMN'));
      expect(stmt).toBeDefined();
      expect(stmt).toContain('tasks');
      expect(stmt).toContain('type');
    });

    it('type column defaults to "task" for backcompat', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find((q) => q.includes('ADD COLUMN'));
      expect(stmt).toContain("DEFAULT 'task'");
    });

    it('type column is NOT NULL', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find((q) => q.includes('ADD COLUMN'));
      expect(stmt).toContain('NOT NULL');
    });

    it('ADD COLUMN uses IF NOT EXISTS for idempotency', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find((q) => q.includes('ADD COLUMN'));
      expect(stmt).toContain('IF NOT EXISTS');
    });

    it('creates idx_tasks_type index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_tasks_type'))).toBe(true);
    });

    it('idx_tasks_type uses CREATE INDEX IF NOT EXISTS for idempotency', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_tasks_type'));
      expect(idx).toContain('IF NOT EXISTS');
    });

    it('idx_tasks_type targets the type column', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_tasks_type'));
      expect(idx).toContain('(type)');
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
    it('drops idx_tasks_type', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_tasks_type'))).toBe(true);
    });

    it('drops the type column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find((q) => q.includes('DROP COLUMN'));
      expect(stmt).toBeDefined();
      expect(stmt).toContain('type');
    });

    it('uses IF EXISTS clauses for safety', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.every((q) => q.includes('IF EXISTS'))).toBe(true);
    });

    it('drops index before column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idxIdx = calls.findIndex((q) => q.includes('idx_tasks_type'));
      const colIdx = calls.findIndex((q) => q.includes('DROP COLUMN'));
      expect(idxIdx).toBeGreaterThanOrEqual(0);
      expect(colIdx).toBeGreaterThanOrEqual(0);
      expect(idxIdx).toBeLessThan(colIdx);
    });
  });
});
