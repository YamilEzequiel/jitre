import type { QueryRunner } from 'typeorm';
import { Fase6DomainCore1700000000500 } from './1700000000500-Fase6DomainCore';

describe('Fase6DomainCore1700000000500', () => {
  let migration: Fase6DomainCore1700000000500;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase6DomainCore1700000000500();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates statuses table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "statuses"'))).toBe(
        true,
      );
    });

    it('creates labels table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "labels"'))).toBe(true);
    });

    it('creates custom_fields table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "custom_fields"')),
      ).toBe(true);
    });

    it('creates projects table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "projects"'))).toBe(
        true,
      );
    });

    it('creates project_memberships table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "project_memberships"')),
      ).toBe(true);
    });

    it('creates tasks table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "tasks"'))).toBe(true);
    });

    it('creates task_assignments table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('CREATE TABLE "task_assignments"')),
      ).toBe(true);
    });

    it('creates task_labels table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('CREATE TABLE "task_labels"'))).toBe(
        true,
      );
    });

    it('creates unique index on (workspace_id, key) for projects', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('uq_projects_ws_key'))).toBe(true);
    });

    it('creates index on tasks(project_id)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_tasks_project_id'))).toBe(true);
    });

    it('creates index on tasks(status_id)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_tasks_status_id'))).toBe(true);
    });

    it('creates index on tasks(rank)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_tasks_rank'))).toBe(true);
    });

    it('creates index on tasks(due_date)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_tasks_due_date'))).toBe(true);
    });

    it('creates unique index on task_assignments(task_id, user_id)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('uq_task_assignments_task_user')),
      ).toBe(true);
    });

    it('creates unique index on task_labels(task_id, label_id)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('uq_task_labels_task_label'))).toBe(
        true,
      );
    });

    it('creates unique index on project_memberships(project_id, user_id)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('uq_project_memberships_project_user')),
      ).toBe(true);
    });

    it('tasks table has parent_task_id FK with ON DELETE SET NULL', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some(
          (q) => q.includes('fk_tasks_parent_task') && q.includes('SET NULL'),
        ),
      ).toBe(true);
    });

    it('adds FK from projects.workspace_id to workspaces', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('fk_projects_ws'))).toBe(true);
    });

    it('adds FK from tasks.project_id to projects', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('fk_tasks_project'))).toBe(true);
    });

    it('adds FK from tasks.status_id to statuses', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('fk_tasks_status'))).toBe(true);
    });
  });

  describe('down()', () => {
    it('drops task_labels table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "task_labels"')),
      ).toBe(true);
    });

    it('drops task_assignments table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) =>
          q.includes('DROP TABLE IF EXISTS "task_assignments"'),
        ),
      ).toBe(true);
    });

    it('drops tasks table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "tasks"')),
      ).toBe(true);
    });

    it('drops projects table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "projects"')),
      ).toBe(true);
    });

    it('drops project_memberships table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) =>
          q.includes('DROP TABLE IF EXISTS "project_memberships"'),
        ),
      ).toBe(true);
    });

    it('drops statuses table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(
        calls.some((q) => q.includes('DROP TABLE IF EXISTS "statuses"')),
      ).toBe(true);
    });

    it('drops tables in reverse dependency order (task_labels before tasks before projects)', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const taskLabelsIdx = calls.findIndex((q) => q.includes('"task_labels"'));
      const tasksIdx = calls.findIndex(
        (q) => q.includes('"tasks"') && q.includes('DROP'),
      );
      const projectsIdx = calls.findIndex(
        (q) => q.includes('"projects"') && q.includes('DROP'),
      );
      expect(taskLabelsIdx).toBeLessThan(tasksIdx);
      expect(tasksIdx).toBeLessThan(projectsIdx);
    });
  });
});
