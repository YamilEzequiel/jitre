import type { QueryRunner } from 'typeorm';
import { Fase10Chat1700000001000 } from './1700000001000-Fase10Chat';

describe('Fase10Chat1700000001000', () => {
  let migration: Fase10Chat1700000001000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase10Chat1700000001000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates chat_channels table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find(
        (q) => q.includes('CREATE TABLE') && q.includes('chat_channels'),
      );
      expect(stmt).toBeDefined();
      expect(stmt).toContain('IF NOT EXISTS');
    });

    it('creates chat_memberships table with composite PK', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find(
        (q) => q.includes('CREATE TABLE') && q.includes('chat_memberships'),
      );
      expect(stmt).toBeDefined();
      expect(stmt).toContain('PRIMARY KEY ("channel_id", "user_id")');
    });

    it('creates chat_messages table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const stmt = calls.find(
        (q) => q.includes('CREATE TABLE') && q.includes('chat_messages'),
      );
      expect(stmt).toBeDefined();
      expect(stmt).toContain('jsonb');
    });

    it('creates partial index on chat_channels (workspace_id) excluding soft-deleted', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_chat_channels_workspace'));
      expect(idx).toBeDefined();
      expect(idx).toMatch(/deleted_at"? IS NULL/);
    });

    it('creates composite index on chat_messages (channel_id, created_at DESC)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const idx = calls.find((q) => q.includes('idx_chat_messages_channel_time'));
      expect(idx).toBeDefined();
      expect(idx).toContain('created_at');
    });

    it('adds FK from chat_channels to workspaces with CASCADE delete', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fk = calls.find((q) => q.includes('fk_chat_channels_workspace'));
      expect(fk).toBeDefined();
      expect(fk).toContain('REFERENCES "workspaces"');
      expect(fk).toContain('ON DELETE CASCADE');
    });

    it('adds FK from chat_memberships to chat_channels', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fk = calls.find((q) => q.includes('fk_chat_memberships_channel'));
      expect(fk).toBeDefined();
      expect(fk).toContain('REFERENCES "chat_channels"');
    });

    it('adds FK from chat_messages parent self-reference with SET NULL', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const fk = calls.find((q) => q.includes('fk_chat_messages_parent'));
      expect(fk).toBeDefined();
      expect(fk).toContain('ON DELETE SET NULL');
    });

    it('all CREATE INDEX statements are idempotent', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const indexStmts = calls.filter((q) => q.includes('CREATE INDEX'));
      expect(indexStmts.length).toBeGreaterThan(0);
      for (const s of indexStmts) {
        expect(s).toContain('IF NOT EXISTS');
      }
    });

    it('all CREATE TABLE statements are idempotent', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const tableStmts = calls.filter((q) => q.includes('CREATE TABLE'));
      expect(tableStmts).toHaveLength(3);
      for (const s of tableStmts) {
        expect(s).toContain('IF NOT EXISTS');
      }
    });
  });

  describe('down()', () => {
    it('drops chat_messages before chat_channels (FK order)', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const msgIdx = calls.findIndex((q) =>
        q.includes('DROP TABLE') && q.includes('chat_messages'),
      );
      const chIdx = calls.findIndex((q) =>
        q.includes('DROP TABLE') && q.includes('chat_channels'),
      );
      expect(msgIdx).toBeGreaterThanOrEqual(0);
      expect(chIdx).toBeGreaterThanOrEqual(0);
      expect(msgIdx).toBeLessThan(chIdx);
    });

    it('uses IF EXISTS in all DROP statements', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      for (const s of calls) {
        expect(s).toContain('IF EXISTS');
      }
    });
  });
});
