import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `user_reports_to` table — a directed graph of "X reports to Y"
 * relationships scoped to a workspace.
 *
 *  - Rows are soft-deleted (deleted_at) so we keep historical org charts.
 *  - Uniqueness is enforced by a PARTIAL unique index limited to active rows,
 *    which lets us re-create a relationship after it has been removed
 *    without colliding with the tombstone row.
 *  - Two btree indexes for the two read directions:
 *      who does this user report to?     (workspace_id, user_id)
 *      who reports to this supervisor?   (workspace_id, reports_to_user_id)
 *
 * Cycle detection (other than direct A↔B cycles) is enforced in the service
 * layer, not in the DB.
 */
export class AddUserReportsTo1700000002200 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_reports_to (
        id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reports_to_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at            timestamptz NOT NULL DEFAULT now(),
        created_by_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deleted_at            timestamptz,
        CHECK (user_id <> reports_to_user_id)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reports_to_active
        ON user_reports_to (workspace_id, user_id, reports_to_user_id)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_reports_to_workspace_user
        ON user_reports_to (workspace_id, user_id)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_reports_to_workspace_supervisor
        ON user_reports_to (workspace_id, reports_to_user_id)
        WHERE deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_user_reports_to_workspace_supervisor`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_user_reports_to_workspace_user`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS uq_user_reports_to_active`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_reports_to`);
  }
}
