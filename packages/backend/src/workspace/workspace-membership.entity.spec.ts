import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { WorkspaceMembershipEntity } from './workspace-membership.entity';
import { UserEntity } from '../user/user.entity';
import { WorkspaceEntity } from './workspace.entity';
import { TenantEntity } from '../common/entities/tenant.entity';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('WorkspaceMembershipEntity', () => {
  it('is decorated with @Entity("workspace_memberships")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find(
      (t) => t.target === WorkspaceMembershipEntity,
    );
    expect(table?.name).toBe('workspace_memberships');
  });

  it('has userId column', () => {
    const col = ownColumns(WorkspaceMembershipEntity).find(
      (c) => c.propertyName === 'userId',
    );
    expect(col).toBeDefined();
  });

  it('has workspaceId column', () => {
    const col = ownColumns(WorkspaceMembershipEntity).find(
      (c) => c.propertyName === 'workspaceId',
    );
    expect(col).toBeDefined();
  });

  it('has role column with default MEMBER', () => {
    const col = ownColumns(WorkspaceMembershipEntity).find(
      (c) => c.propertyName === 'role',
    );
    expect(col).toBeDefined();
    expect(col?.options.default).toBe('member');
  });

  it('has ManyToOne relation to UserEntity', () => {
    const storage = getMetadataArgsStorage();
    const rel = storage.relations.find(
      (r) =>
        r.target === WorkspaceMembershipEntity && r.propertyName === 'user',
    );
    expect(rel).toBeDefined();
    expect(rel?.relationType).toBe('many-to-one');
    const relType = (rel?.type as () => typeof UserEntity)();
    expect(relType).toBe(UserEntity);
  });

  it('has ManyToOne relation to WorkspaceEntity', () => {
    const storage = getMetadataArgsStorage();
    const rel = storage.relations.find(
      (r) =>
        r.target === WorkspaceMembershipEntity &&
        r.propertyName === 'workspace',
    );
    expect(rel).toBeDefined();
    expect(rel?.relationType).toBe('many-to-one');
    const relType = (rel?.type as () => typeof WorkspaceEntity)();
    expect(relType).toBe(WorkspaceEntity);
  });

  it('does NOT extend TenantEntity', () => {
    expect(WorkspaceMembershipEntity.prototype).not.toBeInstanceOf(
      TenantEntity,
    );
  });
});
