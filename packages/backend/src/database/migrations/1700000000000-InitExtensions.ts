import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial migration — only enables Postgres extensions that subsequent
 * migrations will rely on. No tables yet (those land in Fase 2 with the
 * `User` and `Workspace` entities).
 *
 * Extensions:
 *   - uuid-ossp : `uuid_generate_v4()` for default UUID columns.
 *   - pg_trgm   : trigram search used by `SearchService` in Fase 5.
 *   - citext    : case-insensitive text (used for `User.email` in Fase 2).
 */
export class InitExtensions1700000000000 implements MigrationInterface {
  name = 'InitExtensions1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "citext"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_trgm"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
