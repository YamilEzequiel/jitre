import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { WorkspaceEntity } from './workspace.entity';
import { UserEntity } from '../user/user.entity';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('WorkspaceEntity', () => {
  it('is decorated with @Entity("workspaces")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === WorkspaceEntity);
    expect(table?.name).toBe('workspaces');
  });

  it('has name column', () => {
    const col = ownColumns(WorkspaceEntity).find(
      (c) => c.propertyName === 'name',
    );
    expect(col).toBeDefined();
  });

  it('has slug unique column', () => {
    const col = ownColumns(WorkspaceEntity).find(
      (c) => c.propertyName === 'slug',
    );
    expect(col).toBeDefined();
    expect(col?.options.unique).toBe(true);
  });

  it('has description nullable column', () => {
    const col = ownColumns(WorkspaceEntity).find(
      (c) => c.propertyName === 'description',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has ownerId FK column referencing users', () => {
    const col = ownColumns(WorkspaceEntity).find(
      (c) => c.propertyName === 'ownerId',
    );
    expect(col).toBeDefined();
  });

  it('has a ManyToOne relation to UserEntity via ownerId', () => {
    const storage = getMetadataArgsStorage();
    const rel = storage.relations.find(
      (r) => r.target === WorkspaceEntity && r.propertyName === 'owner',
    );
    expect(rel).toBeDefined();
    expect(rel?.relationType).toBe('many-to-one');
    const relType = (rel?.type as () => typeof UserEntity)();
    expect(relType).toBe(UserEntity);
  });

  it('has a OneToMany relation for memberships', () => {
    const storage = getMetadataArgsStorage();
    const rel = storage.relations.find(
      (r) => r.target === WorkspaceEntity && r.propertyName === 'memberships',
    );
    expect(rel).toBeDefined();
    expect(rel?.relationType).toBe('one-to-many');
  });
});
