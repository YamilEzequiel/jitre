import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Fase6DomainCore1700000000500 implements MigrationInterface {
  name = 'Fase6DomainCore1700000000500';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. statuses ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "statuses" (
        "id"           uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        "created_by"   uuid,
        "updated_by"   uuid,
        "version"      integer           NOT NULL DEFAULT 1,
        "workspace_id" uuid              NOT NULL,
        "name"         varchar           NOT NULL,
        "color"        varchar,
        "order"        integer           NOT NULL DEFAULT 0,
        "category"     varchar           NOT NULL,
        "is_default"   boolean           NOT NULL DEFAULT false,
        "project_id"   uuid,
        CONSTRAINT "pk_statuses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_statuses_workspace_id" ON "statuses" ("workspace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_statuses_project_id" ON "statuses" ("project_id")`,
    );

    // ── 2. labels ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "labels" (
        "id"           uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        "created_by"   uuid,
        "updated_by"   uuid,
        "version"      integer           NOT NULL DEFAULT 1,
        "workspace_id" uuid              NOT NULL,
        "name"         varchar           NOT NULL,
        "color"        varchar,
        "scope"        varchar           NOT NULL DEFAULT 'workspace',
        "project_id"   uuid,
        CONSTRAINT "pk_labels" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_labels_workspace_id" ON "labels" ("workspace_id")`,
    );

    // ── 3. custom_fields ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "custom_fields" (
        "id"           uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        "created_by"   uuid,
        "updated_by"   uuid,
        "version"      integer           NOT NULL DEFAULT 1,
        "workspace_id" uuid              NOT NULL,
        "name"         varchar           NOT NULL,
        "type"         varchar           NOT NULL,
        "options"      jsonb,
        "required"     boolean           NOT NULL DEFAULT false,
        "scope"        varchar           NOT NULL DEFAULT 'workspace',
        "project_id"   uuid,
        CONSTRAINT "pk_custom_fields" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_custom_fields_workspace_id" ON "custom_fields" ("workspace_id")`,
    );

    // ── 4. projects ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"            uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"    TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ,
        "created_by"    uuid,
        "updated_by"    uuid,
        "version"       integer           NOT NULL DEFAULT 1,
        "workspace_id"  uuid              NOT NULL,
        "name"          varchar           NOT NULL,
        "key"           varchar(8)        NOT NULL,
        "description"   text,
        "status"        varchar           NOT NULL DEFAULT 'active',
        "color"         varchar,
        "icon"          varchar,
        "owner_user_id" uuid              NOT NULL,
        "start_date"    date,
        "target_date"   date,
        CONSTRAINT "pk_projects" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_projects_ws_key" ON "projects" ("workspace_id", "key") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_projects_workspace_id" ON "projects" ("workspace_id")`,
    );

    // ── 5. project_memberships ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "project_memberships" (
        "id"           uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        "created_by"   uuid,
        "updated_by"   uuid,
        "version"      integer           NOT NULL DEFAULT 1,
        "workspace_id" uuid              NOT NULL,
        "project_id"   uuid              NOT NULL,
        "user_id"      uuid              NOT NULL,
        "role"         varchar           NOT NULL DEFAULT 'contributor',
        "assigned_at"  TIMESTAMPTZ       NOT NULL DEFAULT now(),
        CONSTRAINT "pk_project_memberships" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_project_memberships_project_user" ON "project_memberships" ("project_id", "user_id") WHERE deleted_at IS NULL`,
    );

    // ── 6. tasks ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"               uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"       TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMPTZ,
        "created_by"       uuid,
        "updated_by"       uuid,
        "version"          integer           NOT NULL DEFAULT 1,
        "workspace_id"     uuid              NOT NULL,
        "project_id"       uuid              NOT NULL,
        "status_id"        uuid              NOT NULL,
        "title"            varchar           NOT NULL,
        "description"      text,
        "priority"         varchar           NOT NULL DEFAULT 'none',
        "due_date"         date,
        "start_date"       date,
        "estimated_hours"  numeric,
        "parent_task_id"   uuid,
        "rank"             text              NOT NULL DEFAULT 'n',
        "custom_fields"    jsonb             NOT NULL DEFAULT '{}',
        "completed_at"     TIMESTAMPTZ,
        CONSTRAINT "pk_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_project_id" ON "tasks" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_status_id" ON "tasks" ("status_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_rank" ON "tasks" ("rank")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_due_date" ON "tasks" ("due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_workspace_id" ON "tasks" ("workspace_id")`,
    );

    // tasks self-FK (parent_task_id ON DELETE SET NULL)
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_parent_task" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL`,
    );

    // ── 7. task_assignments ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_assignments" (
        "id"                 uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"         TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"         TIMESTAMPTZ,
        "created_by"         uuid,
        "updated_by"         uuid,
        "version"            integer           NOT NULL DEFAULT 1,
        "workspace_id"       uuid              NOT NULL,
        "task_id"            uuid              NOT NULL,
        "user_id"            uuid              NOT NULL,
        "assigned_at"        TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "assigned_by_user_id" uuid,
        CONSTRAINT "pk_task_assignments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_task_assignments_task_user" ON "task_assignments" ("task_id", "user_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_assignments_task_id" ON "task_assignments" ("task_id")`,
    );

    // ── 8. task_labels ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_labels" (
        "id"           uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMPTZ,
        "created_by"   uuid,
        "updated_by"   uuid,
        "version"      integer           NOT NULL DEFAULT 1,
        "workspace_id" uuid              NOT NULL,
        "task_id"      uuid              NOT NULL,
        "label_id"     uuid              NOT NULL,
        CONSTRAINT "pk_task_labels" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_task_labels_task_label" ON "task_labels" ("task_id", "label_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_labels_task_id" ON "task_labels" ("task_id")`,
    );

    // ── FK constraints ───────────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "fk_projects_ws" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" ADD CONSTRAINT "fk_pm_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "statuses" ADD CONSTRAINT "fk_statuses_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "labels" ADD CONSTRAINT "fk_labels_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_fields" ADD CONSTRAINT "fk_cf_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_status" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_assignments" ADD CONSTRAINT "fk_ta_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_labels" ADD CONSTRAINT "fk_tl_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_labels" ADD CONSTRAINT "fk_tl_label" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FKs first, then tables in reverse dependency order
    await queryRunner.query(
      `ALTER TABLE "task_labels" DROP CONSTRAINT IF EXISTS "fk_tl_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_labels" DROP CONSTRAINT IF EXISTS "fk_tl_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_assignments" DROP CONSTRAINT IF EXISTS "fk_ta_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "fk_tasks_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "fk_tasks_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "fk_tasks_parent_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_fields" DROP CONSTRAINT IF EXISTS "fk_cf_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "labels" DROP CONSTRAINT IF EXISTS "fk_labels_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "statuses" DROP CONSTRAINT IF EXISTS "fk_statuses_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_memberships" DROP CONSTRAINT IF EXISTS "fk_pm_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "fk_projects_ws"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "task_labels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_fields"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "labels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "statuses"`);
  }
}
