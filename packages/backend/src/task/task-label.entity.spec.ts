import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { TaskLabelEntity } from './task-label.entity';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('TaskLabelEntity', () => {
  it('is decorated with @Entity("task_labels")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === TaskLabelEntity);
    expect(table?.name).toBe('task_labels');
  });

  it('has taskId column', () => {
    const col = ownColumns(TaskLabelEntity).find(
      (c) => c.propertyName === 'taskId',
    );
    expect(col).toBeDefined();
  });

  it('has labelId column', () => {
    const col = ownColumns(TaskLabelEntity).find(
      (c) => c.propertyName === 'labelId',
    );
    expect(col).toBeDefined();
  });

  it('has @Unique constraint on (taskId, labelId)', () => {
    const storage = getMetadataArgsStorage();
    const uniques = storage.uniques.filter((u) => u.target === TaskLabelEntity);
    const unique = uniques.some(
      (u) =>
        Array.isArray(u.columns) &&
        u.columns.includes('taskId') &&
        u.columns.includes('labelId'),
    );
    expect(unique).toBe(true);
  });

  it('inherits workspaceId from TenantEntity', () => {
    const tl = new TaskLabelEntity();
    tl.workspaceId = 'ws-uuid-1';
    expect(tl.workspaceId).toBe('ws-uuid-1');
  });
});
