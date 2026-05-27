import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Workspace-scoped library of prompt templates the AI module picks up
 * for `describe`, `suggest_subtasks`, `summary` and `generate_draft`.
 *
 * One row may be flagged `is_default = true` per (workspace_id,
 * operation) — enforced by a partial unique index that excludes
 * soft-deleted rows.
 */
export class AddAiPromptTemplates1700000002600 implements MigrationInterface {
  name = 'AddAiPromptTemplates1700000002600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_prompt_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        "workspace_id" uuid NOT NULL,
        "operation" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "system_prompt" text NOT NULL,
        "user_template" text NOT NULL,
        "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_builtin" boolean NOT NULL DEFAULT false,
        "created_by_user_id" uuid,
        CONSTRAINT "pk_ai_prompt_templates" PRIMARY KEY ("id"),
        CONSTRAINT "ck_ai_prompt_templates_operation"
          CHECK ("operation" IN ('describe', 'suggest_subtasks', 'summary', 'generate_draft'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_ai_prompt_templates_workspace_id"
        ON "ai_prompt_templates" ("workspace_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_ai_prompt_templates_workspace_op"
        ON "ai_prompt_templates" ("workspace_id", "operation")
    `);

    // Partial unique: at most one default per (workspace, operation)
    // while the row is alive.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_ai_prompt_templates_default_per_op"
        ON "ai_prompt_templates" ("workspace_id", "operation")
        WHERE "is_default" = true AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_ai_prompt_templates_default_per_op"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_ai_prompt_templates_workspace_op"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_ai_prompt_templates_workspace_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_prompt_templates"`);
  }
}
