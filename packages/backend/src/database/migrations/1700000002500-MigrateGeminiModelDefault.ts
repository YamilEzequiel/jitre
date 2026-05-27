import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google retired `gemini-1.5-pro` (EOL September 2025). Existing workspaces
 * keep that value in `setting` rows from the previous default. This migration
 * rewrites any `ai.gemini.model` setting still pointing to a deprecated model
 * to the current default `gemini-2.5-flash`.
 *
 * `setting.value` is a jsonb column, so the literal stored for a string is
 * the JSON-encoded form (with quotes): "gemini-1.5-pro".
 */
export class MigrateGeminiModelDefault1700000002500 implements MigrationInterface {
  name = 'MigrateGeminiModelDefault1700000002500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE setting
      SET value = '"gemini-2.5-flash"'::jsonb
      WHERE scope = 'ai'
        AND key = 'ai.gemini.model'
        AND value::text IN ('"gemini-1.5-pro"', '"gemini-1.5-flash"', '"gemini-pro"')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort revert: only roll back rows that currently hold the
    // post-migration default. We can't restore the exact previous value
    // because the migration is lossy by design.
    await queryRunner.query(`
      UPDATE setting
      SET value = '"gemini-1.5-pro"'::jsonb
      WHERE scope = 'ai'
        AND key = 'ai.gemini.model'
        AND value::text = '"gemini-2.5-flash"'
    `);
  }
}
