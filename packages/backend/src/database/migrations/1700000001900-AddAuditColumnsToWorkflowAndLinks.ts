import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes a regression in 1700000001800: `task_links` and `workflow_transitions`
 * extend BaseEntity which expects `created_by` and `updated_by` columns, but
 * the original migration only created `created_by` on task_links and none on
 * workflow_transitions. Reads through TypeORM then fail with:
 *   column TaskLinkEntity.updated_by does not exist
 *
 * This migration is additive — `IF NOT EXISTS` keeps it idempotent if any of
 * the columns were created out-of-band.
 */
export class AddAuditColumnsToWorkflowAndLinks1700000001900
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE task_links
        ADD COLUMN IF NOT EXISTS updated_by uuid
    `);
    await queryRunner.query(`
      ALTER TABLE workflow_transitions
        ADD COLUMN IF NOT EXISTS created_by uuid,
        ADD COLUMN IF NOT EXISTS updated_by uuid
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workflow_transitions
        DROP COLUMN IF EXISTS updated_by,
        DROP COLUMN IF EXISTS created_by
    `);
    await queryRunner.query(`
      ALTER TABLE task_links
        DROP COLUMN IF EXISTS updated_by
    `);
  }
}
