import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { TaskChecklistItemEntity } from './task-checklist-item.entity';
import { TaskChecklistItemStatus } from '@jitre/shared';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('TaskChecklistItemEntity', () => {
  it('is decorated with @Entity("task_checklist_items")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === TaskChecklistItemEntity);
    expect(table?.name).toBe('task_checklist_items');
  });

  it('has taskId column', () => {
    const col = ownColumns(TaskChecklistItemEntity).find(
      (c) => c.propertyName === 'taskId',
    );
    expect(col).toBeDefined();
  });

  it('has content column (text)', () => {
    const col = ownColumns(TaskChecklistItemEntity).find(
      (c) => c.propertyName === 'content',
    );
    expect(col).toBeDefined();
    expect(col?.options.type).toBe('text');
  });

  it('defaults status to pending', () => {
    const col = ownColumns(TaskChecklistItemEntity).find(
      (c) => c.propertyName === 'status',
    );
    expect(col).toBeDefined();
    expect(col?.options.default).toBe(TaskChecklistItemStatus.PENDING);
  });

  it('has order column for stable sorting', () => {
    const col = ownColumns(TaskChecklistItemEntity).find(
      (c) => c.propertyName === 'order',
    );
    expect(col).toBeDefined();
    expect(col?.options.type).toBe('integer');
  });

  it('has nullable completedByUserId column for QA traceability', () => {
    const col = ownColumns(TaskChecklistItemEntity).find(
      (c) => c.propertyName === 'completedByUserId',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has nullable completedAt column', () => {
    const col = ownColumns(TaskChecklistItemEntity).find(
      (c) => c.propertyName === 'completedAt',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('indexes taskId so listing per task is cheap', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter(
      (i) => i.target === TaskChecklistItemEntity,
    );
    const onTaskId = indices.some(
      (i) => Array.isArray(i.columns) && i.columns.includes('taskId'),
    );
    expect(onTaskId).toBe(true);
  });

  it('inherits workspaceId from TenantEntity', () => {
    const item = new TaskChecklistItemEntity();
    item.workspaceId = 'ws-uuid-1';
    expect(item.workspaceId).toBe('ws-uuid-1');
  });
});
