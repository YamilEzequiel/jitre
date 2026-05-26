import type { QueryRunner } from 'typeorm';
import { Fase4StorageAttachmentsComments1700000000300 } from './1700000000300-Fase4StorageAttachmentsComments';

describe('Fase4StorageAttachmentsComments1700000000300', () => {
  let migration: Fase4StorageAttachmentsComments1700000000300;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase4StorageAttachmentsComments1700000000300();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates attachments table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "attachments"'))).toBe(
        true,
      );
    });

    it('creates comments table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "comments"'))).toBe(
        true,
      );
    });

    it('creates attachments indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('uq_attachment_storage_key_active')),
      ).toBe(true);
      expect(calls.some((q) => q.includes('idx_attachment_ws_ctx'))).toBe(true);
    });

    it('creates comment indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_comment_ws_ctx_time'))).toBe(
        true,
      );
      expect(calls.some((q) => q.includes('idx_comment_parent'))).toBe(true);
    });

    it('adds foreign key constraints', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('fk_attachment_workspace'))).toBe(
        true,
      );
      expect(calls.some((q) => q.includes('fk_comment_workspace'))).toBe(true);
    });
  });

  describe('down()', () => {
    it('drops both tables', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "comments"')),
      ).toBe(true);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "attachments"')),
      ).toBe(true);
    });
  });
});
