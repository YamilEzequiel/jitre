import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds optional employee-style fields to the existing `users` table so the
 * Employees module can show richer profiles without introducing a separate
 * entity. All columns are nullable — existing users are unaffected.
 *
 * Why not a separate `employees` table:
 * - A workspace member IS the user; we don't model multi-employer per user.
 * - Keeps auth, sessions and memberships untouched.
 * - Existing avatarUrl already lives on users — phone/position/etc. join
 *   that same row naturally.
 */
export class AddEmployeeFieldsToUsers1700000001700 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS phone varchar(32),
        ADD COLUMN IF NOT EXISTS position varchar(120),
        ADD COLUMN IF NOT EXISTS department varchar(120),
        ADD COLUMN IF NOT EXISTS hire_date date,
        ADD COLUMN IF NOT EXISTS birth_date date,
        ADD COLUMN IF NOT EXISTS address text,
        ADD COLUMN IF NOT EXISTS bio text,
        ADD COLUMN IF NOT EXISTS employee_code varchar(40),
        ADD COLUMN IF NOT EXISTS emergency_contact varchar(200)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS emergency_contact,
        DROP COLUMN IF EXISTS employee_code,
        DROP COLUMN IF EXISTS bio,
        DROP COLUMN IF EXISTS address,
        DROP COLUMN IF EXISTS birth_date,
        DROP COLUMN IF EXISTS hire_date,
        DROP COLUMN IF EXISTS department,
        DROP COLUMN IF EXISTS position,
        DROP COLUMN IF EXISTS phone
    `);
  }
}
