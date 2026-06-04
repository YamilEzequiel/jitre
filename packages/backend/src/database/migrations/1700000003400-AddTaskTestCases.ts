import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `task_test_cases` — structured test cases attached to a task. They sit
 * next to `task_checklist_items`: checklist items express acceptance criteria
 * as free-form text, test cases break the same idea down into precondition /
 * steps / expected so a QA can execute them as-is.
 *
 * Schema follows the standard TenantEntity contract (tenant + audit +
 * soft-delete + optimistic-locking) and adds:
 *  - `task_id`              — FK to tasks, ON DELETE CASCADE.
 *  - `title`                — short name of the case.
 *  - `precondition`         — given/setup (markdown ok, nullable).
 *  - `steps`                — when/actions (markdown ok, nullable).
 *  - `expected`             — then/result (markdown ok, nullable).
 *  - `status`               — pending | passed | failed | blocked | skipped.
 *  - `order`                — stable client-controlled ordering inside a task.
 *  - `completed_by_user_id` — QA who last moved the case out of `pending`.
 *  - `completed_at`         — timestamp of that transition.
 */
export class AddTaskTestCases1700000003400 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_test_cases (
        id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id          uuid NOT NULL,
        task_id               uuid NOT NULL,
        title                 varchar NOT NULL,
        precondition          text,
        steps                 text,
        expected              text,
        status                varchar NOT NULL DEFAULT 'pending',
        "order"               integer NOT NULL DEFAULT 0,
        completed_by_user_id  uuid,
        completed_at          timestamptz,
        created_at            timestamptz NOT NULL DEFAULT now(),
        updated_at            timestamptz NOT NULL DEFAULT now(),
        deleted_at            timestamptz,
        created_by            uuid,
        updated_by            uuid,
        version               integer NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      ALTER TABLE task_test_cases
        ADD CONSTRAINT fk_task_test_cases_task
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_test_cases_workspace
        ON task_test_cases (workspace_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_test_cases_task
        ON task_test_cases (task_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_test_cases_task_order
        ON task_test_cases (task_id, "order")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_task_test_cases_task_order`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_task_test_cases_task`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_task_test_cases_workspace`,
    );
    await queryRunner.query(`
      ALTER TABLE task_test_cases
        DROP CONSTRAINT IF EXISTS fk_task_test_cases_task
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS task_test_cases`);
  }
}
