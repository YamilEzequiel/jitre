import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One narrative AI digest per (workspace, day). The cron upserts here.
 */
export class AddAiDailyDigests1700000002700 implements MigrationInterface {
  name = 'AddAiDailyDigests1700000002700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_daily_digests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        "workspace_id" uuid NOT NULL,
        "digest_date" date NOT NULL,
        "summary" text NOT NULL,
        "tasks_created" integer NOT NULL DEFAULT 0,
        "tasks_completed" integer NOT NULL DEFAULT 0,
        "comments_posted" integer NOT NULL DEFAULT 0,
        "time_logged_minutes" integer NOT NULL DEFAULT 0,
        "model" text NOT NULL,
        CONSTRAINT "pk_ai_daily_digests" PRIMARY KEY ("id"),
        CONSTRAINT "ux_ai_daily_digests_workspace_date" UNIQUE ("workspace_id", "digest_date")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_ai_daily_digests_workspace_date"
        ON "ai_daily_digests" ("workspace_id", "digest_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_ai_daily_digests_workspace_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_daily_digests"`);
  }
}
