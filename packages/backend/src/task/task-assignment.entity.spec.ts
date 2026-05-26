import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { TaskAssignmentEntity } from './task-assignment.entity';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('TaskAssignmentEntity', () => {
  it('is decorated with @Entity("task_assignments")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === TaskAssignmentEntity);
    expect(table?.name).toBe('task_assignments');
  });

  it('has taskId column', () => {
    const col = ownColumns(TaskAssignmentEntity).find(
      (c) => c.propertyName === 'taskId',
    );
    expect(col).toBeDefined();
  });

  it('has userId column', () => {
    const col = ownColumns(TaskAssignmentEntity).find(
      (c) => c.propertyName === 'userId',
    );
    expect(col).toBeDefined();
  });

  it('has assignedAt column', () => {
    const col = ownColumns(TaskAssignmentEntity).find(
      (c) => c.propertyName === 'assignedAt',
    );
    expect(col).toBeDefined();
  });

  it('has assignedByUserId nullable column', () => {
    const col = ownColumns(TaskAssignmentEntity).find(
      (c) => c.propertyName === 'assignedByUserId',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has @Unique constraint on (taskId, userId)', () => {
    const storage = getMetadataArgsStorage();
    const uniques = storage.uniques.filter(
      (u) => u.target === TaskAssignmentEntity,
    );
    const unique = uniques.some(
      (u) =>
        Array.isArray(u.columns) &&
        u.columns.includes('taskId') &&
        u.columns.includes('userId'),
    );
    expect(unique).toBe(true);
  });

  it('inherits workspaceId from TenantEntity', () => {
    const a = new TaskAssignmentEntity();
    a.workspaceId = 'ws-uuid-1';
    expect(a.workspaceId).toBe('ws-uuid-1');
  });
});
