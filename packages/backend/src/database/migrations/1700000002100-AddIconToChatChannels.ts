import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds an `icon` column to `chat_channels` so users can pick an emoji
 * to represent the channel in the sidebar and channel header.
 *
 * Width is 8 characters: enough to store any single Unicode emoji, including
 * ZWJ sequences (e.g. 👨‍💻) and skin-tone modifiers (e.g. 👍🏽).
 */
export class AddIconToChatChannels1700000002100 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_channels
        ADD COLUMN IF NOT EXISTS icon varchar(8)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_channels
        DROP COLUMN IF EXISTS icon
    `);
  }
}
