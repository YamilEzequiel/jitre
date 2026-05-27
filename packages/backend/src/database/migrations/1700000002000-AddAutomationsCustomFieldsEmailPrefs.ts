import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two feature groups in one migration so a single backend restart picks
 * them up together.
 *
 *  1) automations + automation_runs
 *     Rule engine. Each row is a (trigger, conditions, actions) tuple scoped
 *     to a project. Runs are append-only for audit.
 *
 *  2) Email preference columns on users
 *     Per-user opt-out toggles for mention / assignment / due-date emails.
 *
 * Note: typed custom fields were already implemented under
 * `custom_fields` (CustomFieldEntity) so no migration is needed here for
 * that — only the frontend UI work remains.
 */
export class AddAutomationsCustomFieldsEmailPrefs1700000002000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1) automations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS automations (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name            varchar(120) NOT NULL,
        description     text,
        enabled         boolean NOT NULL DEFAULT true,
        trigger         varchar(40) NOT NULL,
        trigger_config  jsonb,
        conditions      jsonb,
        actions         jsonb NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        deleted_at      timestamptz,
        created_by      uuid,
        updated_by      uuid,
        version         integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_automations_project_enabled
        ON automations (project_id, enabled)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_automations_trigger
        ON automations (workspace_id, trigger, enabled)
        WHERE deleted_at IS NULL
    `);

    // automation_runs — append-only audit trail
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS automation_runs (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    uuid NOT NULL,
        automation_id   uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
        triggered_at    timestamptz NOT NULL DEFAULT now(),
        status          varchar(20) NOT NULL,
        context         jsonb,
        error           text
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_automation_runs_automation
        ON automation_runs (automation_id, triggered_at DESC)
    `);

    // 2) Email preferences on users
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_mentions boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_assignments boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_due_dates boolean NOT NULL DEFAULT true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS email_due_dates,
        DROP COLUMN IF EXISTS email_assignments,
        DROP COLUMN IF EXISTS email_mentions
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_automation_runs_automation`);
    await queryRunner.query(`DROP TABLE IF EXISTS automation_runs`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_automations_trigger`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_automations_project_enabled`);
    await queryRunner.query(`DROP TABLE IF EXISTS automations`);
  }
}
