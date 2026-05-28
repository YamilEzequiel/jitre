import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds parent context to search documents so a comment hit can navigate
 * back to its task or project without an extra round-trip. Backfill of
 * existing comment rows happens via a one-shot UPDATE from comments.
 */
export class AddSearchDocParentContext1700000002900
  implements MigrationInterface
{
  name = 'AddSearchDocParentContext1700000002900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "search_documents"
        ADD COLUMN "parent_type" text,
        ADD COLUMN "parent_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_search_documents_parent"
        ON "search_documents" ("workspace_id", "parent_type", "parent_id")
        WHERE "parent_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    // Backfill comment search docs with their context. Tasks and projects
    // never had parents — leave them NULL.
    await queryRunner.query(`
      UPDATE "search_documents" sd
      SET "parent_type" = c."context",
          "parent_id"   = c."context_id"
      FROM "comments" c
      WHERE sd."entity_type" = 'comment'
        AND sd."entity_id" = c."id"
        AND sd."deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ix_search_documents_parent"`,
    );
    await queryRunner.query(`
      ALTER TABLE "search_documents"
        DROP COLUMN IF EXISTS "parent_type",
        DROP COLUMN IF EXISTS "parent_id"
    `);
  }
}
