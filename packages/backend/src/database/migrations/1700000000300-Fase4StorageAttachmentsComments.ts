import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fase4StorageAttachmentsComments1700000000300 implements MigrationInterface {
  name = 'Fase4StorageAttachmentsComments1700000000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id"                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"        uuid NOT NULL,
        "context"             text NOT NULL,
        "context_id"          uuid,
        "uploaded_by_user_id" uuid NOT NULL,
        "storage_key"         text NOT NULL,
        "original_filename"   text NOT NULL,
        "mime_type"           text NOT NULL,
        "size_bytes"          bigint NOT NULL,
        "checksum"            text,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz,
        "created_by"          uuid,
        "updated_by"          uuid,
        "version"             int NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_attachment_storage_key_active"
        ON "attachments" ("storage_key")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_attachment_ws_ctx"
        ON "attachments" ("workspace_id", "context", "context_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_attachment_ws_user_time"
        ON "attachments" ("workspace_id", "uploaded_by_user_id", "created_at" DESC)
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD CONSTRAINT "fk_attachment_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "attachments"
        ADD CONSTRAINT "fk_attachment_uploader"
        FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspace_id"       uuid NOT NULL,
        "context"            text NOT NULL,
        "context_id"         uuid NOT NULL,
        "author_user_id"     uuid NOT NULL,
        "body"               text NOT NULL,
        "mentioned_user_ids" uuid[] NOT NULL DEFAULT '{}',
        "parent_id"          uuid,
        "edited_at"          timestamptz,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "created_by"         uuid,
        "updated_by"         uuid,
        "version"            int NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_comment_ws_ctx_time"
        ON "comments" ("workspace_id", "context", "context_id", "created_at" DESC)
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_comment_ws_author_time"
        ON "comments" ("workspace_id", "author_user_id", "created_at" DESC)
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_comment_parent"
        ON "comments" ("parent_id")
        WHERE "deleted_at" IS NULL AND "parent_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
        ADD CONSTRAINT "fk_comment_workspace"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
        ADD CONSTRAINT "fk_comment_author"
        FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
        ADD CONSTRAINT "fk_comment_parent"
        FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attachments"`);
  }
}
