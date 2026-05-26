import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatChannelMetadata1700000001600
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_channels
        ADD COLUMN IF NOT EXISTS kind varchar NOT NULL DEFAULT 'custom',
        ADD COLUMN IF NOT EXISTS project_id uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_channels_kind
        ON chat_channels (workspace_id, kind)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_channels_project_channel
        ON chat_channels (workspace_id, project_id)
        WHERE deleted_at IS NULL AND kind = 'project' AND project_id IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_chat_channels_project_channel`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chat_channels_kind`);
    await queryRunner.query(`
      ALTER TABLE chat_channels
        DROP COLUMN IF EXISTS project_id,
        DROP COLUMN IF EXISTS kind
    `);
  }
}
