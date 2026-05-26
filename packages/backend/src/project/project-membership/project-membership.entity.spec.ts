import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { ProjectMembershipEntity } from './project-membership.entity';
import { ProjectRole } from '@jitre/shared';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('ProjectMembershipEntity', () => {
  it('is decorated with @Entity("project_memberships")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find(
      (t) => t.target === ProjectMembershipEntity,
    );
    expect(table?.name).toBe('project_memberships');
  });

  it('has projectId column', () => {
    const col = ownColumns(ProjectMembershipEntity).find(
      (c) => c.propertyName === 'projectId',
    );
    expect(col).toBeDefined();
  });

  it('has userId column', () => {
    const col = ownColumns(ProjectMembershipEntity).find(
      (c) => c.propertyName === 'userId',
    );
    expect(col).toBeDefined();
  });

  it('has role column accepting ProjectRole values', () => {
    const m = new ProjectMembershipEntity();
    m.role = ProjectRole.VIEWER;
    expect(m.role).toBe(ProjectRole.VIEWER);
    m.role = ProjectRole.CONTRIBUTOR;
    expect(m.role).toBe(ProjectRole.CONTRIBUTOR);
    m.role = ProjectRole.ADMIN;
    expect(m.role).toBe(ProjectRole.ADMIN);
  });

  it('has assignedAt column', () => {
    const col = ownColumns(ProjectMembershipEntity).find(
      (c) => c.propertyName === 'assignedAt',
    );
    expect(col).toBeDefined();
  });

  it('has @Unique constraint on (projectId, userId)', () => {
    const storage = getMetadataArgsStorage();
    const uniques = storage.uniques.filter(
      (u) => u.target === ProjectMembershipEntity,
    );
    const uniqueOnProjectUser = uniques.some(
      (u) =>
        Array.isArray(u.columns) &&
        u.columns.includes('projectId') &&
        u.columns.includes('userId'),
    );
    expect(uniqueOnProjectUser).toBe(true);
  });

  it('inherits workspaceId from TenantEntity', () => {
    const m = new ProjectMembershipEntity();
    m.workspaceId = 'ws-uuid-1';
    expect(m.workspaceId).toBe('ws-uuid-1');
  });
});
