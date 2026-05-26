import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 10 — Task type column + tickets support.
 * Additive only. Uses IF NOT EXISTS for idempotency.
 *
 * Adds:
 *   - tasks.type (varchar NOT NULL DEFAULT 'task') — discriminates between
 *     regular tasks ('task') and internal tickets ('bug' | 'incident' | 'feature').
 *   - idx_tasks_type (tasks.type) — supports filtering /tasks?type=bug list queries.
 *
 * Down: drops the index then the column.
 */
export class Fase10TaskTypeAndTickets1700000000800
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS type varchar NOT NULL DEFAULT 'task'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_type
        ON tasks (type)
        WHERE deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_type`);
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS type`);
  }
}
