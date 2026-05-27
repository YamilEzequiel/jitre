import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Non-mutative priority suggestions emitted by a daily cron.
 * One open suggestion per task — accepting / dismissing flips status
 * and the unique partial index lets the next pass create a fresh one.
 */
export class AddAiPrioritySuggestions1700000002800 implements MigrationInterface {
  name = 'AddAiPrioritySuggestions1700000002800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_priority_suggestions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        "workspace_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "current_priority" varchar NOT NULL,
        "suggested_priority" varchar NOT NULL,
        "reason" text NOT NULL,
        "status" text NOT NULL DEFAULT 'open',
        CONSTRAINT "pk_ai_priority_suggestions" PRIMARY KEY ("id"),
        CONSTRAINT "ck_ai_priority_suggestions_status"
          CHECK ("status" IN ('open', 'accepted', 'dismissed', 'stale'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_ai_priority_suggestions_task" ON "ai_priority_suggestions" ("task_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_ai_priority_suggestions_ws_status"
        ON "ai_priority_suggestions" ("workspace_id", "status")
    `);

    // At most one open suggestion per task at a time (alive rows).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_ai_priority_suggestions_open_per_task"
        ON "ai_priority_suggestions" ("task_id")
        WHERE "status" = 'open' AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_ai_priority_suggestions_open_per_task"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_ai_priority_suggestions_ws_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_ai_priority_suggestions_task"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_priority_suggestions"`);
  }
}
