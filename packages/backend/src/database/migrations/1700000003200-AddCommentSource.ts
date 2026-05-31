import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a `source` column to comments so the UI can show whether a comment was
 * posted from the web app, the VS Code extension, the MCP server or a direct
 * API call. Existing rows are backfilled to 'web'.
 */
export class AddCommentSource1700000003200 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE comments
        ADD COLUMN IF NOT EXISTS source varchar NOT NULL DEFAULT 'web'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE comments
        DROP COLUMN IF EXISTS source
    `);
  }
}
