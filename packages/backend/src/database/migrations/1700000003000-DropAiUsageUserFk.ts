import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the `fk_ai_usage_user` foreign key introduced by Fase7. The original
 * design (see common/constants/system-user.constant.ts) requires that the
 * SYSTEM sentinel user id can flow through `ai_usage_records.user_id`
 * without existing in `users` — needed for scheduler-driven calls such as
 * the daily digest. The FK contradicted that contract and caused 500s on
 * `/api/v1/ai/daily-digest/regenerate`.
 */
export class DropAiUsageUserFk1700000003000 implements MigrationInterface {
  name = 'DropAiUsageUserFk1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_usage_records" DROP CONSTRAINT IF EXISTS "fk_ai_usage_user"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_usage_records"
        ADD CONSTRAINT "fk_ai_usage_user"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE SET NULL
    `);
  }
}
