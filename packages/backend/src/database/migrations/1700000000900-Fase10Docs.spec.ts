import type { QueryRunner } from 'typeorm';
import { Fase10Docs1700000000900 } from './1700000000900-Fase10Docs';

describe('Fase10Docs1700000000900', () => {
  let migration: Fase10Docs1700000000900;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new Fase10Docs1700000000900();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('creates the documents table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const create = calls.find((q) => q.includes('CREATE TABLE "documents"'));
      expect(create).toBeDefined();
    });

    it('declares workspace_id, project_id, parent_id columns', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const create = queryRunner.query.mock.calls
        .map((c) => c[0])
        .find((q) => q.includes('CREATE TABLE "documents"'))!;
      expect(create).toContain('"workspace_id"');
      expect(create).toContain('"project_id"');
      expect(create).toContain('"parent_id"');
    });

    it('declares title, content (jsonb) and content_text columns', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const create = queryRunner.query.mock.calls
        .map((c) => c[0])
        .find((q) => q.includes('CREATE TABLE "documents"'))!;
      expect(create).toContain('"title"');
      expect(create).toMatch(/"content"\s+jsonb/);
      expect(create).toContain('"content_text"');
    });

    it('declares the creator_user_id and last_edited_by_user_id columns', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const create = queryRunner.query.mock.calls
        .map((c) => c[0])
        .find((q) => q.includes('CREATE TABLE "documents"'))!;
      expect(create).toContain('"creator_user_id"');
      expect(create).toContain('"last_edited_by_user_id"');
    });

    it('creates idx_documents_workspace_id', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_documents_workspace_id'))).toBe(
        true,
      );
    });

    it('creates idx_documents_project_id and idx_documents_parent_id', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_documents_project_id'))).toBe(
        true,
      );
      expect(calls.some((q) => q.includes('idx_documents_parent_id'))).toBe(
        true,
      );
    });

    it('creates idx_documents_order', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('idx_documents_order'))).toBe(true);
    });

    it('adds FK fk_documents_ws to workspaces (CASCADE)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const fk = queryRunner.query.mock.calls
        .map((c) => c[0])
        .find((q) => q.includes('fk_documents_ws'));
      expect(fk).toContain('REFERENCES "workspaces"');
      expect(fk).toContain('ON DELETE CASCADE');
    });

    it('adds FK fk_documents_project to projects (CASCADE)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const fk = queryRunner.query.mock.calls
        .map((c) => c[0])
        .find((q) => q.includes('fk_documents_project'));
      expect(fk).toContain('REFERENCES "projects"');
      expect(fk).toContain('ON DELETE CASCADE');
    });

    it('adds self-referential FK fk_documents_parent (CASCADE)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const fk = queryRunner.query.mock.calls
        .map((c) => c[0])
        .find((q) => q.includes('fk_documents_parent'));
      expect(fk).toContain('REFERENCES "documents"');
      expect(fk).toContain('ON DELETE CASCADE');
    });
  });

  describe('down()', () => {
    it('drops the documents table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q) => q.includes('DROP TABLE IF EXISTS "documents"'))).toBe(
        true,
      );
    });

    it('drops the indexes before dropping the table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const calls = queryRunner.query.mock.calls.map((c) => c[0]);
      const tableIdx = calls.findIndex((q) => q.includes('DROP TABLE'));
      const indexIdx = calls.findIndex((q) =>
        q.includes('idx_documents_workspace_id'),
      );
      expect(indexIdx).toBeGreaterThanOrEqual(0);
      expect(indexIdx).toBeLessThan(tableIdx);
    });

    it('drops all FKs with IF EXISTS', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const fkCalls = queryRunner.query.mock.calls
        .map((c) => c[0])
        .filter((q) => q.includes('DROP CONSTRAINT'));
      expect(fkCalls.length).toBeGreaterThanOrEqual(3);
      for (const fk of fkCalls) {
        expect(fk).toContain('IF EXISTS');
      }
    });
  });
});
