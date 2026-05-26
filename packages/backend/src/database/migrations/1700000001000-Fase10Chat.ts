import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 10 — Chat module (channels, memberships, messages).
 * Additive only. Uses IF NOT EXISTS for idempotency.
 *
 * Tables:
 *   - chat_channels      — workspace-scoped chat channels (public/private/dm)
 *   - chat_memberships   — composite-PK join (channel_id, user_id)
 *   - chat_messages      — workspace-scoped messages with optional thread parent
 */
export class Fase10Chat1700000001000 implements MigrationInterface {
  name = 'Fase10Chat1700000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // chat_channels --------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_channels" (
        "id"                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"          uuid NOT NULL,
        "name"                  varchar NOT NULL,
        "description"           text,
        "type"                  varchar NOT NULL,
        "created_by_user_id"    uuid NOT NULL,
        "last_message_at"       timestamptz,
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_at"            timestamptz NOT NULL DEFAULT now(),
        "deleted_at"            timestamptz,
        "created_by"            uuid,
        "updated_by"            uuid,
        "version"               int NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_channels_workspace"
        ON "chat_channels" ("workspace_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_channels_type"
        ON "chat_channels" ("type")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_channels_ws_last_msg"
        ON "chat_channels" ("workspace_id", "last_message_at" DESC NULLS LAST)
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_channels"
        ADD CONSTRAINT "fk_chat_channels_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    // chat_memberships -----------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_memberships" (
        "channel_id"             uuid NOT NULL,
        "user_id"                uuid NOT NULL,
        "joined_at"              timestamptz NOT NULL DEFAULT now(),
        "last_read_message_id"   uuid,
        "notification_level"     varchar NOT NULL DEFAULT 'all',
        PRIMARY KEY ("channel_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_memberships_user"
        ON "chat_memberships" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_memberships_channel"
        ON "chat_memberships" ("channel_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_memberships"
        ADD CONSTRAINT "fk_chat_memberships_channel"
        FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_memberships"
        ADD CONSTRAINT "fk_chat_memberships_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // chat_messages --------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id"                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"        uuid NOT NULL,
        "channel_id"          uuid NOT NULL,
        "author_id"           uuid NOT NULL,
        "body"                text NOT NULL,
        "parent_message_id"   uuid,
        "attachments"         jsonb NOT NULL DEFAULT '[]'::jsonb,
        "edited_at"           timestamptz,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz,
        "created_by"          uuid,
        "updated_by"          uuid,
        "version"             int NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_channel_time"
        ON "chat_messages" ("channel_id", "created_at" DESC)
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_author"
        ON "chat_messages" ("author_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_parent"
        ON "chat_messages" ("parent_message_id")
        WHERE "deleted_at" IS NULL AND "parent_message_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_workspace"
        ON "chat_messages" ("workspace_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD CONSTRAINT "fk_chat_messages_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD CONSTRAINT "fk_chat_messages_channel"
        FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD CONSTRAINT "fk_chat_messages_author"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD CONSTRAINT "fk_chat_messages_parent"
        FOREIGN KEY ("parent_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_channels"`);
  }
}
