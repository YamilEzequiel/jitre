import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 8 — Analytics indexes.
 * Additive only. Uses IF NOT EXISTS for idempotency.
 *
 * Creates:
 *   - idx_audit_ws_action_time  (audit_logs)         — for velocity/throughput queries
 *   - idx_project_memberships_user_workspace          — for ADR-6 membership filter
 *
 * Fase 3 already has idx_audit_ws_time (workspace_id, occurred_at).
 * Fase 7 already has idx_ai_usage_ws_time / ws_user_time / ws_op_time.
 * Fase 6 already has idx_tasks_completed.
 */
export class Fase8AnalyticsIndexes1700000000700 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_ws_action_time
        ON audit_logs (workspace_id, action, occurred_at DESC)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_project_memberships_user_workspace
        ON project_memberships (user_id, workspace_id)
        WHERE deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_project_memberships_user_workspace`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_ws_action_time`);
  }
}
