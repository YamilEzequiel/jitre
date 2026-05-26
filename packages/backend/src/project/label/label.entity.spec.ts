import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { LabelEntity } from './label.entity';
import { LabelScope } from '@jitre/shared';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('LabelEntity', () => {
  it('is decorated with @Entity("labels")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === LabelEntity);
    expect(table?.name).toBe('labels');
  });

  it('has name column', () => {
    const col = ownColumns(LabelEntity).find((c) => c.propertyName === 'name');
    expect(col).toBeDefined();
  });

  it('has color column', () => {
    const col = ownColumns(LabelEntity).find((c) => c.propertyName === 'color');
    expect(col).toBeDefined();
  });

  it('has scope column with LabelScope values', () => {
    const l = new LabelEntity();
    l.scope = LabelScope.WORKSPACE;
    expect(l.scope).toBe(LabelScope.WORKSPACE);
    l.scope = LabelScope.PROJECT;
    expect(l.scope).toBe(LabelScope.PROJECT);
  });

  it('has projectId nullable column', () => {
    const col = ownColumns(LabelEntity).find(
      (c) => c.propertyName === 'projectId',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('projectId can be null (workspace-scope label)', () => {
    const l = new LabelEntity();
    l.projectId = null;
    expect(l.projectId).toBeNull();
  });

  it('inherits workspaceId from TenantEntity', () => {
    const l = new LabelEntity();
    l.workspaceId = 'ws-uuid-1';
    expect(l.workspaceId).toBe('ws-uuid-1');
  });
});
