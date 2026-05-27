import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds optional metadata fields to the `projects` table so the Projects
 * module can describe each project beyond name/key/description:
 *
 *   - category        free-text classifier (e.g. "Internal", "Client", "R&D")
 *   - framework       primary tech stack identifier (e.g. "Angular", "NestJS")
 *   - database        database technology (e.g. "PostgreSQL"); quoted in DDL
 *                     because it is a reserved word in some SQL dialects
 *                     (PostgreSQL accepts it unquoted, but we stay defensive)
 *   - customer_name   free-text customer label — no separate Customer entity
 *                     exists yet, so we keep this as plain text. A future
 *                     migration can introduce a customer_id FK and backfill.
 *   - repository_url  Git repository URL for quick navigation
 *
 * All columns are nullable; existing rows are unaffected.
 */
export class AddProjectMetadata1700000002400 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS category varchar(40),
        ADD COLUMN IF NOT EXISTS framework varchar(60),
        ADD COLUMN IF NOT EXISTS "database" varchar(60),
        ADD COLUMN IF NOT EXISTS customer_name varchar(120),
        ADD COLUMN IF NOT EXISTS repository_url varchar(500)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
        DROP COLUMN IF EXISTS repository_url,
        DROP COLUMN IF EXISTS customer_name,
        DROP COLUMN IF EXISTS "database",
        DROP COLUMN IF EXISTS framework,
        DROP COLUMN IF EXISTS category
    `);
  }
}
