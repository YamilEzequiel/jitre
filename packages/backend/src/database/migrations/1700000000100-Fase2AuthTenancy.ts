import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fase2AuthTenancy1700000000100 implements MigrationInterface {
  name = 'Fase2AuthTenancy1700000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email"         citext UNIQUE NOT NULL,
        "password_hash" text NOT NULL,
        "display_name"  text NOT NULL,
        "avatar_url"    text,
        "status"        text NOT NULL DEFAULT 'active',
        "last_login_at" timestamptz,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz,
        "created_by"    uuid,
        "updated_by"    uuid,
        "version"       int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_users_status_active"
        ON "users" ("status")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"        text NOT NULL,
        "slug"        text UNIQUE NOT NULL,
        "description" text,
        "owner_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        "deleted_at"  timestamptz,
        "created_by"  uuid,
        "updated_by"  uuid,
        "version"     int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_workspaces_owner"
        ON "workspaces" ("owner_id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "workspace_memberships" (
        "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "role"         text NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "deleted_at"   timestamptz,
        "created_by"   uuid,
        "updated_by"   uuid,
        "version"      int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_membership_user_ws_active"
        ON "workspace_memberships" ("user_id", "workspace_id")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_membership_user_ws_role"
        ON "workspace_memberships" ("user_id", "workspace_id", "role")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_membership_ws_role"
        ON "workspace_memberships" ("workspace_id", "role")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id"            uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "refresh_token_hash" text NOT NULL,
        "device_info"        jsonb NOT NULL DEFAULT '{}'::jsonb,
        "last_used_at"       timestamptz NOT NULL DEFAULT now(),
        "expires_at"         timestamptz NOT NULL,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "created_by"         uuid,
        "updated_by"         uuid,
        "version"            int NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_sessions_refresh_hash_active"
        ON "sessions" ("refresh_token_hash")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_sessions_user_active"
        ON "sessions" ("user_id", "expires_at")
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
