import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds workspace-scoped "areas" (departments / squads) and FK columns on
 * users + projects so they can be grouped under a shared organizational
 * unit.
 *
 *  - `areas` extends the standard TenantEntity contract: tenant + audit +
 *    soft-delete + optimistic-locking columns.
 *  - Name uniqueness is enforced via a PARTIAL unique index on
 *    `(workspace_id, name) WHERE deleted_at IS NULL` so a soft-deleted
 *    area does not block re-using its name.
 *  - `users.area_id` and `projects.area_id` are NULLABLE with
 *    `ON DELETE SET NULL` so a hard-deleted area dangles cleanly.
 *    Soft-deletes are handled at the service layer (AreaService.softDelete
 *    nullifies references explicitly before stamping deleted_at).
 */
export class AddAreas1700000002300 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id  uuid NOT NULL,
        name          varchar(80) NOT NULL,
        color         varchar(20) NOT NULL,
        icon          varchar(40),
        description   text,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        deleted_at    timestamptz,
        created_by    uuid,
        updated_by    uuid,
        version       integer NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_areas_workspace_id
        ON areas (workspace_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_areas_workspace_name_active
        ON areas (workspace_id, name)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS area_id uuid
    `);
    await queryRunner.query(`
      ALTER TABLE users
        ADD CONSTRAINT fk_users_area
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_area_id
        ON users (area_id)
    `);

    await queryRunner.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS area_id uuid
    `);
    await queryRunner.query(`
      ALTER TABLE projects
        ADD CONSTRAINT fk_projects_area
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_area_id
        ON projects (area_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_area_id`);
    await queryRunner.query(`
      ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_area
    `);
    await queryRunner.query(`
      ALTER TABLE projects DROP COLUMN IF EXISTS area_id
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_area_id`);
    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_area
    `);
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS area_id
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_areas_workspace_name_active`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_areas_workspace_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS areas`);
  }
}
