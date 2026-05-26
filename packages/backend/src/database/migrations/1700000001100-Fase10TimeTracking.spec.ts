import type { QueryRunner } from 'typeorm';
import { Fase10TimeTracking1700000001100 } from './1700000001100-Fase10TimeTracking';

describe('Fase10TimeTracking1700000001100', () => {
  let migration: Fase10TimeTracking1700000001100;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase10TimeTracking1700000001100();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates time_entries table (idempotent)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find(
        (q) => q.includes('CREATE TABLE') && q.includes('time_entries'),
      );
      expect(stmt).toBeDefined();
      expect(stmt).toContain('IF NOT EXISTS');
      expect(stmt).toContain('duration_minutes');
      expect(stmt).toContain('billable');
      expect(stmt).toContain('started_at');
      expect(stmt).toContain('stopped_at');
    });

    it('creates index on workspace_id (partial, soft-delete aware)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_time_entries_workspace'));
      expect(idx).toBeDefined();
      expect(idx).toMatch(/deleted_at"? IS NULL/);
    });

    it('creates index on task_id', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_time_entries_task'));
      expect(idx).toBeDefined();
    });

    it('creates index on user_id', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_time_entries_user"'));
      expect(idx).toBeDefined();
    });

    it('creates composite index on (user_id, date DESC)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_time_entries_user_date'));
      expect(idx).toBeDefined();
      expect(idx).toContain('"date" DESC');
    });

    it('creates partial unique index for one active timer per user', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) =>
        q.includes('uq_time_entries_active_timer_per_user'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('UNIQUE');
      expect(idx).toMatch(/started_at"? IS NOT NULL/);
      expect(idx).toMatch(/stopped_at"? IS NULL/);
    });

    it('adds FK to workspaces with CASCADE', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fk = calls.find((q) => q.includes('fk_time_entries_workspace'));
      expect(fk).toBeDefined();
      expect(fk).toContain('REFERENCES "workspaces"');
      expect(fk).toContain('ON DELETE CASCADE');
    });

    it('adds FK to tasks with CASCADE', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fk = calls.find((q) => q.includes('fk_time_entries_task'));
      expect(fk).toBeDefined();
      expect(fk).toContain('REFERENCES "tasks"');
      expect(fk).toContain('ON DELETE CASCADE');
    });

    it('adds FK to users with RESTRICT (preserve historic records)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fk = calls.find((q) => q.includes('fk_time_entries_user'));
      expect(fk).toBeDefined();
      expect(fk).toContain('REFERENCES "users"');
      expect(fk).toContain('ON DELETE RESTRICT');
    });

    it('adds CHECK constraint on duration range (0..1440)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const chk = calls.find((q) =>
        q.includes('chk_time_entries_duration_range'),
      );
      expect(chk).toBeDefined();
      expect(chk).toContain('duration_minutes');
      expect(chk).toContain('1440');
    });

    it('all CREATE INDEX statements are idempotent', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const indexStmts = calls.filter((q) => q.includes('CREATE'));
      const idxOnly = indexStmts.filter((q) => q.includes('INDEX'));
      expect(idxOnly.length).toBeGreaterThan(0);
      for (const s of idxOnly) {
        expect(s).toContain('IF NOT EXISTS');
      }
    });
  });

  describe('down()', () => {
    it('drops time_entries with IF EXISTS', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find(
        (q) => q.includes('DROP TABLE') && q.includes('time_entries'),
      );
      expect(stmt).toBeDefined();
      expect(stmt).toContain('IF EXISTS');
    });
  });
});
