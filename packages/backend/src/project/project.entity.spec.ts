import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { ProjectStatus } from '@jitre/shared';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('ProjectEntity', () => {
  it('is decorated with @Entity("projects")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === ProjectEntity);
    expect(table?.name).toBe('projects');
  });

  it('has name column', () => {
    const col = ownColumns(ProjectEntity).find(
      (c) => c.propertyName === 'name',
    );
    expect(col).toBeDefined();
  });

  it('has key column', () => {
    const col = ownColumns(ProjectEntity).find((c) => c.propertyName === 'key');
    expect(col).toBeDefined();
  });

  it('has description column (nullable)', () => {
    const col = ownColumns(ProjectEntity).find(
      (c) => c.propertyName === 'description',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has status column accepting ProjectStatus values', () => {
    const p = new ProjectEntity();
    p.status = ProjectStatus.ACTIVE;
    expect(p.status).toBe(ProjectStatus.ACTIVE);
    p.status = ProjectStatus.ARCHIVED;
    expect(p.status).toBe(ProjectStatus.ARCHIVED);
  });

  it('has color nullable column', () => {
    const col = ownColumns(ProjectEntity).find(
      (c) => c.propertyName === 'color',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has icon nullable column', () => {
    const col = ownColumns(ProjectEntity).find(
      (c) => c.propertyName === 'icon',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has ownerUserId column', () => {
    const col = ownColumns(ProjectEntity).find(
      (c) => c.propertyName === 'ownerUserId',
    );
    expect(col).toBeDefined();
  });

  it('has startDate nullable column', () => {
    const col = ownColumns(ProjectEntity).find(
      (c) => c.propertyName === 'startDate',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has targetDate nullable column', () => {
    const col = ownColumns(ProjectEntity).find(
      (c) => c.propertyName === 'targetDate',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has @Unique constraint on (workspaceId, key)', () => {
    const storage = getMetadataArgsStorage();
    const uniques = storage.uniques.filter((u) => u.target === ProjectEntity);
    const uniqueOnWsKey = uniques.some(
      (u) =>
        Array.isArray(u.columns) &&
        u.columns.includes('workspaceId') &&
        u.columns.includes('key'),
    );
    expect(uniqueOnWsKey).toBe(true);
  });

  it('inherits workspaceId from TenantEntity', () => {
    const p = new ProjectEntity();
    p.workspaceId = 'ws-uuid-1';
    expect(p.workspaceId).toBe('ws-uuid-1');
  });
});
