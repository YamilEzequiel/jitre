import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures citext and uuid-ossp extensions are present before the Fase 2
 * tables that depend on them. Idempotent — safe to run even if Fase 1 already
 * enabled these extensions.
 */
export class EnableCitext1700000000099 implements MigrationInterface {
  name = 'EnableCitext1700000000099';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op — do not drop shared extensions; they may be used by other migrations.
  }
}
