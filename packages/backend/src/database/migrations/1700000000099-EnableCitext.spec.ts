import type { QueryRunner } from 'typeorm';
import { EnableCitext1700000000099 } from './1700000000099-EnableCitext';

describe('EnableCitext1700000000099', () => {
  let migration: EnableCitext1700000000099;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new EnableCitext1700000000099();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up() executes without error', async () => {
    await expect(
      migration.up(queryRunner as unknown as QueryRunner),
    ).resolves.toBeUndefined();
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE EXTENSION IF NOT EXISTS citext'),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'),
    );
  });

  it('down() executes without error (no-op)', async () => {
    await expect(
      migration.down(queryRunner as unknown as QueryRunner),
    ).resolves.toBeUndefined();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
