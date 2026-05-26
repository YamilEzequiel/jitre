import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { CustomFieldEntity } from './custom-field.entity';
import { CustomFieldType, CustomFieldScope } from '@jitre/shared';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('CustomFieldEntity', () => {
  it('is decorated with @Entity("custom_fields")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === CustomFieldEntity);
    expect(table?.name).toBe('custom_fields');
  });

  it('has name column', () => {
    const col = ownColumns(CustomFieldEntity).find(
      (c) => c.propertyName === 'name',
    );
    expect(col).toBeDefined();
  });

  it('has type column accepting CustomFieldType values', () => {
    const cf = new CustomFieldEntity();
    cf.type = CustomFieldType.TEXT;
    expect(cf.type).toBe(CustomFieldType.TEXT);
    cf.type = CustomFieldType.NUMBER;
    expect(cf.type).toBe(CustomFieldType.NUMBER);
    cf.type = CustomFieldType.SELECT;
    expect(cf.type).toBe(CustomFieldType.SELECT);
  });

  it('has options column (jsonb nullable)', () => {
    const col = ownColumns(CustomFieldEntity).find(
      (c) => c.propertyName === 'options',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has required boolean column', () => {
    const col = ownColumns(CustomFieldEntity).find(
      (c) => c.propertyName === 'required',
    );
    expect(col).toBeDefined();
  });

  it('has scope column', () => {
    const cf = new CustomFieldEntity();
    cf.scope = CustomFieldScope.WORKSPACE;
    expect(cf.scope).toBe(CustomFieldScope.WORKSPACE);
    cf.scope = CustomFieldScope.PROJECT;
    expect(cf.scope).toBe(CustomFieldScope.PROJECT);
  });

  it('has projectId nullable column', () => {
    const col = ownColumns(CustomFieldEntity).find(
      (c) => c.propertyName === 'projectId',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('inherits workspaceId from TenantEntity', () => {
    const cf = new CustomFieldEntity();
    cf.workspaceId = 'ws-uuid-1';
    expect(cf.workspaceId).toBe('ws-uuid-1');
  });
});
