import type { QueryRunner } from 'typeorm';
import { DropAiUsageUserFk1700000003000 } from './1700000003000-DropAiUsageUserFk';

describe('DropAiUsageUserFk1700000003000', () => {
  let migration: DropAiUsageUserFk1700000003000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new DropAiUsageUserFk1700000003000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('drops the fk_ai_usage_user constraint', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (q) =>
            q.includes('DROP CONSTRAINT') && q.includes('fk_ai_usage_user'),
        ),
      ).toBe(true);
    });

    it('uses IF EXISTS so it is idempotent', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (q) =>
            q.includes('fk_ai_usage_user') && q.includes('IF EXISTS'),
        ),
      ).toBe(true);
    });
  });

  describe('down()', () => {
    it('re-adds the FK with ON DELETE SET NULL', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (q) =>
            q.includes('fk_ai_usage_user') &&
            q.includes('REFERENCES "users"') &&
            q.includes('SET NULL'),
        ),
      ).toBe(true);
    });
  });
});
