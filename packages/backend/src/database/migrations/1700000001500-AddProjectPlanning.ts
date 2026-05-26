import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds persisted Jira-style epics, sprints and releases and task planning links. */
export class AddProjectPlanning1700000001500 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS planning_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id uuid NOT NULL,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type varchar NOT NULL,
        name varchar NOT NULL,
        goal text,
        status varchar NOT NULL DEFAULT 'planned',
        color varchar,
        start_date date,
        end_date date,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        created_by uuid,
        updated_by uuid,
        version int NOT NULL DEFAULT 1,
        CONSTRAINT chk_planning_item_type CHECK (type IN ('epic', 'sprint', 'release'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_planning_items_scope
        ON planning_items (workspace_id, project_id, type)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS epic_id uuid REFERENCES planning_items(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES planning_items(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES planning_items(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks (epic_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks (sprint_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_release_id ON tasks (release_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_release_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_sprint_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_epic_id`);
    await queryRunner.query(`
      ALTER TABLE tasks
        DROP COLUMN IF EXISTS release_id,
        DROP COLUMN IF EXISTS sprint_id,
        DROP COLUMN IF EXISTS epic_id
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_planning_items_scope`);
    await queryRunner.query(`DROP TABLE IF EXISTS planning_items`);
  }
}
