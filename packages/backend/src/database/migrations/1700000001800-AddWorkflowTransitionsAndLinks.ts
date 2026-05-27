import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two new feature tables — both opt-in / additive, so existing projects
 * continue to behave like before:
 *
 *  workflow_transitions
 *    Models the allowed status transitions per project. When a project has
 *    zero rows the task service falls back to "any -> any" (legacy behavior),
 *    so we don't break older projects on first deploy.
 *
 *  task_links
 *    Generic typed link between two tasks within the same workspace
 *    (blocks, relates_to, duplicates, clones). Symmetry is enforced at the
 *    service level, not by the DB, to keep the model simple.
 */
export class AddWorkflowTransitionsAndLinks1700000001800
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workflow_transitions (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        from_status_id  uuid NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
        to_status_id    uuid NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
        requires_assignee boolean NOT NULL DEFAULT false,
        label           varchar(80),
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        deleted_at      timestamptz,
        version         integer NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_transitions_pair
        ON workflow_transitions (project_id, from_status_id, to_status_id)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_transitions_project
        ON workflow_transitions (project_id)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_links (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        target_task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        link_type       varchar(40) NOT NULL,
        created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        deleted_at      timestamptz,
        version         integer NOT NULL DEFAULT 1,
        CHECK (source_task_id <> target_task_id)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_task_links_triple
        ON task_links (source_task_id, target_task_id, link_type)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_links_source
        ON task_links (source_task_id)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_links_target
        ON task_links (target_task_id)
        WHERE deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_task_links_target`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_task_links_source`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_task_links_triple`);
    await queryRunner.query(`DROP TABLE IF EXISTS task_links`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workflow_transitions_project`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_workflow_transitions_pair`);
    await queryRunner.query(`DROP TABLE IF EXISTS workflow_transitions`);
  }
}
