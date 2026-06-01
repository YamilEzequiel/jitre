import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `task_checklist_items` — first-class acceptance criteria / QA cases
 * attached to a task. Until now they lived as free-form markdown inside
 * `tasks.description`, which made it impossible to trace WHO validated WHAT
 * and WHEN.
 *
 * Schema follows the standard TenantEntity contract (tenant + audit +
 * soft-delete + optimistic-locking) and adds:
 *  - `task_id`              — FK to tasks, ON DELETE CASCADE (an item makes
 *                             no sense without its task).
 *  - `content`              — the criterion text (markdown ok).
 *  - `status`               — pending | passed | failed | blocked.
 *  - `order`                — stable client-controlled ordering inside a task.
 *  - `completed_by_user_id` — QA who last moved the item out of `pending`.
 *  - `completed_at`         — timestamp of that transition.
 *
 * Trazabilidad is intentionally additive: `created_by` / `updated_by` (from
 * BaseEntity) cover who created/edited the row, while `completed_by_user_id`
 * captures the QA decision separately.
 */
export class AddTaskChecklistItems1700000003300 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_checklist_items (
        id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id          uuid NOT NULL,
        task_id               uuid NOT NULL,
        content               text NOT NULL,
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
      ALTER TABLE task_checklist_items
        ADD CONSTRAINT fk_task_checklist_items_task
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_checklist_items_workspace
        ON task_checklist_items (workspace_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task
        ON task_checklist_items (task_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_order
        ON task_checklist_items (task_id, "order")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_task_checklist_items_task_order`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_task_checklist_items_task`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_task_checklist_items_workspace`,
    );
    await queryRunner.query(`
      ALTER TABLE task_checklist_items
        DROP CONSTRAINT IF EXISTS fk_task_checklist_items_task
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS task_checklist_items`);
  }
}
