import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google retired `gemini-1.5-pro` (EOL September 2025). Existing workspaces
 * keep that value in `ai_settings` rows from the previous default. This
 * migration rewrites any `ai.gemini.model` setting still pointing to a
 * deprecated model to the current default `gemini-2.5-flash`.
 *
 * AiSetting.value is a jsonb column that stores a JSON-encoded string for
 * scalar settings, so the literal stored for "gemini-1.5-pro" is the
 * quoted form `"gemini-1.5-pro"`.
 */
export class MigrateGeminiModelDefault1700000002500 implements MigrationInterface {
  name = 'MigrateGeminiModelDefault1700000002500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: only run if the ai_settings table exists. This makes the
    // migration safe on databases that haven't gone through the AI phase
    // yet (e.g. fresh installs where Fase 5 settings migration ran but
    // AI settings haven't been created yet).
    const hasTable = await queryRunner.hasTable('ai_settings');
    if (!hasTable) return;

    await queryRunner.query(`
      UPDATE ai_settings
      SET value = '"gemini-2.5-flash"'::jsonb
      WHERE key = 'ai.gemini.model'
        AND value::text IN ('"gemini-1.5-pro"', '"gemini-1.5-flash"', '"gemini-pro"')
        AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('ai_settings');
    if (!hasTable) return;

    // Best-effort revert: only roll back rows that currently hold the
    // post-migration default. We can't restore the exact previous value
    // because the migration is lossy by design.
    await queryRunner.query(`
      UPDATE ai_settings
      SET value = '"gemini-1.5-pro"'::jsonb
      WHERE key = 'ai.gemini.model'
        AND value::text = '"gemini-2.5-flash"'
        AND deleted_at IS NULL
    `);
  }
}
