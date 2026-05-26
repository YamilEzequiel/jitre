import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { StatusEntity } from './status.entity';
import { StatusCategory } from '@jitre/shared';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('StatusEntity', () => {
  it('is decorated with @Entity("statuses")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === StatusEntity);
    expect(table?.name).toBe('statuses');
  });

  it('has name column', () => {
    const col = ownColumns(StatusEntity).find((c) => c.propertyName === 'name');
    expect(col).toBeDefined();
  });

  it('has color column', () => {
    const col = ownColumns(StatusEntity).find(
      (c) => c.propertyName === 'color',
    );
    expect(col).toBeDefined();
  });

  it('has order column', () => {
    const col = ownColumns(StatusEntity).find(
      (c) => c.propertyName === 'order',
    );
    expect(col).toBeDefined();
  });

  it('has category column', () => {
    const col = ownColumns(StatusEntity).find(
      (c) => c.propertyName === 'category',
    );
    expect(col).toBeDefined();
  });

  it('category accepts StatusCategory enum values', () => {
    const s = new StatusEntity();
    s.category = StatusCategory.TODO;
    expect(s.category).toBe(StatusCategory.TODO);
    s.category = StatusCategory.IN_PROGRESS;
    expect(s.category).toBe(StatusCategory.IN_PROGRESS);
    s.category = StatusCategory.DONE;
    expect(s.category).toBe(StatusCategory.DONE);
  });

  it('has isDefault boolean column', () => {
    const col = ownColumns(StatusEntity).find(
      (c) => c.propertyName === 'isDefault',
    );
    expect(col).toBeDefined();
  });

  it('has projectId column that is nullable', () => {
    const col = ownColumns(StatusEntity).find(
      (c) => c.propertyName === 'projectId',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('projectId can be set to null (workspace-catalog status)', () => {
    const s = new StatusEntity();
    s.projectId = null;
    expect(s.projectId).toBeNull();
  });

  it('projectId can be set to a uuid string', () => {
    const s = new StatusEntity();
    s.projectId = 'proj-uuid-1';
    expect(s.projectId).toBe('proj-uuid-1');
  });

  it('inherits workspaceId from TenantEntity', () => {
    const s = new StatusEntity();
    s.workspaceId = 'ws-uuid-1';
    expect(s.workspaceId).toBe('ws-uuid-1');
  });
});
