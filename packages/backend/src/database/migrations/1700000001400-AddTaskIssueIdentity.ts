import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds Jira-style immutable issue identity to tasks.
 * Existing tasks are backfilled as PROJECTKEY-N by creation order per project.
 */
export class AddTaskIssueIdentity1700000001400 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS issue_number integer,
        ADD COLUMN IF NOT EXISTS issue_key varchar
    `);

    await queryRunner.query(`
      WITH numbered AS (
        SELECT
          t.id,
          ROW_NUMBER() OVER (PARTITION BY t.project_id ORDER BY t.created_at ASC, t.id ASC) AS issue_number,
          p.key AS project_key
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        WHERE t.issue_number IS NULL OR t.issue_key IS NULL
      )
      UPDATE tasks t
      SET
        issue_number = numbered.issue_number,
        issue_key = numbered.project_key || '-' || numbered.issue_number
      FROM numbered
      WHERE t.id = numbered.id
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_issue_number
        ON tasks (project_id, issue_number)
        WHERE deleted_at IS NULL AND issue_number IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_issue_key
        ON tasks (issue_key)
        WHERE deleted_at IS NULL AND issue_key IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_issue_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_project_issue_number`);
    await queryRunner.query(`
      ALTER TABLE tasks
        DROP COLUMN IF EXISTS issue_key,
        DROP COLUMN IF EXISTS issue_number
    `);
  }
}
