import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fase5JobsSearchSettings1700000000400 implements MigrationInterface {
  name = 'Fase5JobsSearchSettings1700000000400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── job_logs ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "job_logs" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "queue_name"    text NOT NULL,
        "job_type"      text NOT NULL,
        "job_id"        text NOT NULL UNIQUE,
        "status"        text NOT NULL,
        "attempt_count" int NOT NULL DEFAULT 0,
        "error_message" text,
        "payload"       jsonb NOT NULL DEFAULT '{}'::jsonb,
        "duration_ms"   int,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz,
        "created_by"    uuid,
        "updated_by"    uuid
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_jl_queue_status_time"
        ON "job_logs" ("queue_name", "status", "created_at" DESC)
        WHERE "deleted_at" IS NULL
    `);

    // ── search_documents ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "search_documents" (
        "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "entity_type"  text NOT NULL,
        "entity_id"    uuid NOT NULL,
        "content"      text NOT NULL,
        "tsvector"     tsvector NOT NULL,
        "boost"        real NOT NULL DEFAULT 1.0,
        "occurred_at"  timestamptz NOT NULL DEFAULT now(),
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "deleted_at"   timestamptz,
        "created_by"   uuid,
        "updated_by"   uuid
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_sd_ws_type_entity"
        ON "search_documents" ("workspace_id", "entity_type", "entity_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_sd_tsvector"
        ON "search_documents" USING GIN ("tsvector")
    `);

    await queryRunner.query(`
      ALTER TABLE "search_documents"
        ADD CONSTRAINT "fk_sd_ws"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    // ── user_settings ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_settings" (
        "id"         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"    uuid NOT NULL,
        "key"        text NOT NULL,
        "value"      jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "created_by" uuid,
        "updated_by" uuid
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_us_user_key"
        ON "user_settings" ("user_id", "key")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user_settings"
        ADD CONSTRAINT "fk_us_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // ── workspace_settings ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "workspace_settings" (
        "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "key"          text NOT NULL,
        "value"        jsonb NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "deleted_at"   timestamptz,
        "created_by"   uuid,
        "updated_by"   uuid
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_ws_ws_key"
        ON "workspace_settings" ("workspace_id", "key")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
        ADD CONSTRAINT "fk_ws_ws"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    // ── ai_settings ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ai_settings" (
        "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "key"          text NOT NULL,
        "value"        jsonb NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "deleted_at"   timestamptz,
        "created_by"   uuid,
        "updated_by"   uuid
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_ai_ws_key"
        ON "ai_settings" ("workspace_id", "key")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_settings"
        ADD CONSTRAINT "fk_ai_ws"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    // ── notification_settings ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notification_settings" (
        "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"      uuid NOT NULL,
        "workspace_id" uuid,
        "key"          text NOT NULL,
        "value"        jsonb NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "deleted_at"   timestamptz,
        "created_by"   uuid,
        "updated_by"   uuid
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_ns_user_ws_key"
        ON "notification_settings" (
          "user_id",
          COALESCE("workspace_id", '00000000-0000-0000-0000-000000000000'::uuid),
          "key"
        )
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_settings"
        ADD CONSTRAINT "fk_ns_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_settings"
        ADD CONSTRAINT "fk_ns_ws"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK-dependent tables first, then the referenced ones
    await queryRunner.query(
      `ALTER TABLE "notification_settings" DROP CONSTRAINT IF EXISTS "fk_ns_ws"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_settings" DROP CONSTRAINT IF EXISTS "fk_ns_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_settings"`);

    await queryRunner.query(
      `ALTER TABLE "ai_settings" DROP CONSTRAINT IF EXISTS "fk_ai_ws"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_settings"`);

    await queryRunner.query(
      `ALTER TABLE "workspace_settings" DROP CONSTRAINT IF EXISTS "fk_ws_ws"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_settings"`);

    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP CONSTRAINT IF EXISTS "fk_us_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_settings"`);

    await queryRunner.query(
      `ALTER TABLE "search_documents" DROP CONSTRAINT IF EXISTS "fk_sd_ws"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "search_documents"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "job_logs"`);
  }
}
