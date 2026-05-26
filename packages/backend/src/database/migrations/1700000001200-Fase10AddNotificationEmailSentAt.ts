import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 10 — Track when notifications were emailed out.
 * Additive: nullable column, no default, no backfill.
 */
export class Fase10AddNotificationEmailSentAt1700000001200
  implements MigrationInterface
{
  name = 'Fase10AddNotificationEmailSentAt1700000001200';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "email_sent_at" timestamptz
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "email_sent_at"
    `);
  }
}
