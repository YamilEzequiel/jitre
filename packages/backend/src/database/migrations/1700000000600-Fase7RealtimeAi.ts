import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Fase7RealtimeAi1700000000600 implements MigrationInterface {
  name = 'Fase7RealtimeAi1700000000600';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ai_usage_records table
    await queryRunner.query(`
      CREATE TABLE "ai_usage_records" (
        "id"                  uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id"        uuid          NOT NULL,
        "user_id"             uuid          NOT NULL,
        "provider"            text          NOT NULL,
        "model"               text          NOT NULL,
        "operation"           text          NOT NULL,
        "prompt_tokens"       int           NOT NULL DEFAULT 0,
        "completion_tokens"   int           NOT NULL DEFAULT 0,
        "total_tokens"        int           NOT NULL DEFAULT 0,
        "cost_usd"            numeric(12,6) NOT NULL DEFAULT 0,
        "latency_ms"          int           NOT NULL DEFAULT 0,
        "success"             boolean       NOT NULL DEFAULT true,
        "error_code"          text,
        "created_at"          timestamptz   NOT NULL DEFAULT now(),
        "updated_at"          timestamptz   NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz,
        "created_by"          uuid,
        "updated_by"          uuid,
        "version"             int           NOT NULL DEFAULT 1,
        CONSTRAINT "pk_ai_usage_records" PRIMARY KEY ("id")
      )
    `);

    // 2. Partial indexes
    await queryRunner.query(`
      CREATE INDEX "idx_ai_usage_ws_time"
        ON "ai_usage_records" ("workspace_id", "created_at" DESC)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_ai_usage_ws_user_time"
        ON "ai_usage_records" ("workspace_id", "user_id", "created_at" DESC)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_ai_usage_ws_op_time"
        ON "ai_usage_records" ("workspace_id", "operation", "created_at" DESC)
        WHERE deleted_at IS NULL
    `);

    // 3. Foreign keys
    await queryRunner.query(`
      ALTER TABLE "ai_usage_records"
        ADD CONSTRAINT "fk_ai_usage_workspace"
        FOREIGN KEY ("workspace_id")
        REFERENCES "workspaces"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_usage_records"
        ADD CONSTRAINT "fk_ai_usage_user"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop foreign keys first
    await queryRunner.query(`
      ALTER TABLE "ai_usage_records" DROP CONSTRAINT IF EXISTS "fk_ai_usage_workspace"
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_usage_records" DROP CONSTRAINT IF EXISTS "fk_ai_usage_user"
    `);

    // 2. Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_usage_ws_op_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_usage_ws_user_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_usage_ws_time"`);

    // 3. Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_usage_records"`);
  }
}
