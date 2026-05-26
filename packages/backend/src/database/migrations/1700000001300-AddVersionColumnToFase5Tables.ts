import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 5 migration omitted the `version` column on these 6 tables, but the
 * entities extend BaseEntity which has @VersionColumn. Adds the column with
 * default 1 so optimistic-locking queries (TypeORM auto-selects "version")
 * stop failing with `column ... does not exist`.
 */
export class AddVersionColumnToFase5Tables1700000001300
  implements MigrationInterface
{
  private readonly tables = [
    'job_logs',
    'search_documents',
    'user_settings',
    'workspace_settings',
    'ai_settings',
    'notification_settings',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "version" int NOT NULL DEFAULT 1`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "version"`,
      );
    }
  }
}
