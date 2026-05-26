import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 10 — Time Tracking module (Tempo-style time entries).
 * Additive only. Uses IF NOT EXISTS for idempotency.
 *
 * Tables:
 *   - time_entries — workspace-scoped logs of tracked work time
 */
export class Fase10TimeTracking1700000001100 implements MigrationInterface {
  name = 'Fase10TimeTracking1700000001100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "time_entries" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"      uuid NOT NULL,
        "task_id"           uuid NOT NULL,
        "user_id"           uuid NOT NULL,
        "duration_minutes"  integer NOT NULL DEFAULT 0,
        "date"              date NOT NULL,
        "description"       text,
        "billable"          boolean NOT NULL DEFAULT true,
        "started_at"        timestamptz,
        "stopped_at"        timestamptz,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "created_by"        uuid,
        "updated_by"        uuid,
        "version"           int NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_time_entries_workspace"
        ON "time_entries" ("workspace_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_time_entries_task"
        ON "time_entries" ("task_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_time_entries_user"
        ON "time_entries" ("user_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_time_entries_date"
        ON "time_entries" ("date")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_time_entries_user_date"
        ON "time_entries" ("user_id", "date" DESC)
        WHERE "deleted_at" IS NULL
    `);

    // Partial unique index to enforce ONE active timer per user at any time.
    // A row is "active" when started_at IS NOT NULL AND stopped_at IS NULL.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_time_entries_active_timer_per_user"
        ON "time_entries" ("user_id")
        WHERE "started_at" IS NOT NULL
          AND "stopped_at" IS NULL
          AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "time_entries"
        ADD CONSTRAINT "fk_time_entries_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "time_entries"
        ADD CONSTRAINT "fk_time_entries_task"
        FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "time_entries"
        ADD CONSTRAINT "fk_time_entries_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "time_entries"
        ADD CONSTRAINT "chk_time_entries_duration_range"
        CHECK ("duration_minutes" >= 0 AND "duration_minutes" <= 1440)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "time_entries"`);
  }
}
