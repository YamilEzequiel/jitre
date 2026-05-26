import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 10 — Docs/Wiki.
 *
 * Creates the `documents` table for Notion-like pages: workspace-scoped,
 * optionally project-scoped, hierarchical via self-referential `parent_id`
 * (ON DELETE CASCADE), rich content stored as Quill Delta JSON in `content`
 * with a flattened plain-text mirror in `content_text` for search/preview.
 */
export class Fase10Docs1700000000900 implements MigrationInterface {
  name = 'Fase10Docs1700000000900';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id"                     uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"             TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"             TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "deleted_at"             TIMESTAMPTZ,
        "created_by"             uuid,
        "updated_by"             uuid,
        "version"                integer           NOT NULL DEFAULT 1,
        "workspace_id"           uuid              NOT NULL,
        "project_id"             uuid,
        "parent_id"              uuid,
        "title"                  varchar           NOT NULL,
        "icon"                   varchar,
        "content"                jsonb             NOT NULL DEFAULT '{}'::jsonb,
        "content_text"           text              NOT NULL DEFAULT '',
        "order"                  integer           NOT NULL DEFAULT 0,
        "creator_user_id"        uuid              NOT NULL,
        "last_edited_by_user_id" uuid              NOT NULL,
        "last_edited_at"         TIMESTAMPTZ,
        CONSTRAINT "pk_documents" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_documents_workspace_id" ON "documents" ("workspace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_project_id" ON "documents" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_parent_id" ON "documents" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_documents_order" ON "documents" ("order")`,
    );

    // FKs
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_ws" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_parent" FOREIGN KEY ("parent_id") REFERENCES "documents"("id") ON DELETE CASCADE`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "fk_documents_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "fk_documents_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "fk_documents_ws"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_documents_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_documents_parent_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_documents_project_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_documents_workspace_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
  }
}
