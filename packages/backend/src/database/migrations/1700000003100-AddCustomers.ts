import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds workspace-scoped "customers" (clients / accounts) and migrates the
 * pre-existing free-text `projects.customer_name` column into a proper FK
 * relationship.
 *
 *  - `customers` extends the standard TenantEntity contract: tenant + audit +
 *    soft-delete + optimistic-locking columns. Status enum mirrors projects
 *    (`active` / `archived`).
 *  - Name uniqueness is enforced case-insensitively (ignoring surrounding
 *    whitespace) via a PARTIAL unique index over `LOWER(TRIM(name))` while
 *    `deleted_at IS NULL` — so a soft-deleted customer does not block re-use
 *    of its name, and casing variants do not produce duplicates.
 *  - `projects.customer_id` is NULLABLE with `ON DELETE SET NULL`. The old
 *    `projects.customer_name` column is back-filled into `customers` rows
 *    (one row per distinct `LOWER(TRIM(name))` per workspace) and then
 *    dropped to remove the source of truth split.
 */
export class AddCustomers1700000003100 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id  uuid NOT NULL,
        name          varchar(120) NOT NULL,
        status        varchar(20) NOT NULL DEFAULT 'active',
        color         varchar(20) NOT NULL,
        icon          varchar(40),
        email         varchar(180),
        phone         varchar(40),
        tax_id        varchar(40),
        address       varchar(250),
        notes         text,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        deleted_at    timestamptz,
        created_by    uuid,
        updated_by    uuid,
        version       integer NOT NULL DEFAULT 1
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_workspace_id
        ON customers (workspace_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_workspace_name_active
        ON customers (workspace_id, LOWER(TRIM(name)))
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS customer_id uuid
    `);
    await queryRunner.query(`
      ALTER TABLE projects
        ADD CONSTRAINT fk_projects_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_customer_id
        ON projects (customer_id)
    `);

    // ── Backfill: dedupe customer_name per workspace (case-insensitive,
    // trimmed) and insert one customers row per distinct combination. Then
    // link projects.customer_id to the matching row.
    await queryRunner.query(`
      INSERT INTO customers (workspace_id, name, status, color)
      SELECT
        p.workspace_id,
        MIN(TRIM(p.customer_name)) AS name,
        'active' AS status,
        '#2563eb' AS color
      FROM projects p
      WHERE p.customer_name IS NOT NULL
        AND TRIM(p.customer_name) <> ''
      GROUP BY p.workspace_id, LOWER(TRIM(p.customer_name))
    `);

    await queryRunner.query(`
      UPDATE projects p
      SET customer_id = c.id
      FROM customers c
      WHERE c.workspace_id = p.workspace_id
        AND LOWER(TRIM(c.name)) = LOWER(TRIM(p.customer_name))
        AND p.customer_name IS NOT NULL
        AND TRIM(p.customer_name) <> ''
    `);

    // Source of truth now lives in customers — drop the legacy column.
    await queryRunner.query(`
      ALTER TABLE projects DROP COLUMN IF EXISTS customer_name
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create the legacy column and best-effort copy the customer name back.
    await queryRunner.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS customer_name varchar(120)
    `);
    await queryRunner.query(`
      UPDATE projects p
      SET customer_name = c.name
      FROM customers c
      WHERE c.id = p.customer_id
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_customer_id`);
    await queryRunner.query(`
      ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_customer
    `);
    await queryRunner.query(`
      ALTER TABLE projects DROP COLUMN IF EXISTS customer_id
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_customers_workspace_name_active`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_customers_workspace_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS customers`);
  }
}
