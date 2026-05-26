import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fase3EventsAuditNotifications1700000000200 implements MigrationInterface {
  name = 'Fase3EventsAuditNotifications1700000000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"  uuid NOT NULL,
        "actor_user_id" uuid,
        "action"        text NOT NULL,
        "subject_type"  text NOT NULL,
        "subject_id"    uuid NOT NULL,
        "summary"       text NOT NULL,
        "diff"          jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at"   timestamptz NOT NULL DEFAULT now(),
        "request_id"    text,
        "event_id"      uuid NOT NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz,
        "created_by"    uuid,
        "updated_by"    uuid,
        "version"       int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_audit_event_id"
        ON "audit_logs" ("event_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_ws_time"
        ON "audit_logs" ("workspace_id", "occurred_at" DESC)
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_ws_subject_time"
        ON "audit_logs" ("workspace_id", "subject_type", "subject_id", "occurred_at" DESC)
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_audit_ws_actor_time"
        ON "audit_logs" ("workspace_id", "actor_user_id", "occurred_at" DESC)
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "fk_audit_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "fk_audit_actor"
        FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"       uuid NOT NULL,
        "recipient_user_id"  uuid NOT NULL,
        "type"               text NOT NULL,
        "title"              text NOT NULL,
        "body"               text NOT NULL DEFAULT '',
        "data"               jsonb NOT NULL DEFAULT '{}'::jsonb,
        "read_at"            timestamptz,
        "priority"           text NOT NULL DEFAULT 'normal',
        "occurred_at"        timestamptz NOT NULL DEFAULT now(),
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "created_by"         uuid,
        "updated_by"         uuid,
        "version"            int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_notif_recipient_unread"
        ON "notifications" ("recipient_user_id", "read_at")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_notif_ws_time"
        ON "notifications" ("workspace_id", "occurred_at" DESC)
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD CONSTRAINT "fk_notif_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD CONSTRAINT "fk_notif_recipient"
        FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
