import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { TaskEntity } from './task.entity';
import { TaskPriority, TaskType } from '@jitre/shared';

function ownColumns(target: Function) {
  return getMetadataArgsStorage().columns.filter((c) => c.target === target);
}

describe('TaskEntity', () => {
  it('is decorated with @Entity("tasks")', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === TaskEntity);
    expect(table?.name).toBe('tasks');
  });

  it('has projectId column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'projectId',
    );
    expect(col).toBeDefined();
  });

  it('has statusId column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'statusId',
    );
    expect(col).toBeDefined();
  });

  it('has title column', () => {
    const col = ownColumns(TaskEntity).find((c) => c.propertyName === 'title');
    expect(col).toBeDefined();
  });

  it('has description nullable column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'description',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has priority column accepting TaskPriority values', () => {
    const t = new TaskEntity();
    t.priority = TaskPriority.NONE;
    expect(t.priority).toBe(TaskPriority.NONE);
    t.priority = TaskPriority.HIGH;
    expect(t.priority).toBe(TaskPriority.HIGH);
    t.priority = TaskPriority.URGENT;
    expect(t.priority).toBe(TaskPriority.URGENT);
  });

  it('has type column accepting TaskType values', () => {
    const t = new TaskEntity();
    t.type = TaskType.TASK;
    expect(t.type).toBe(TaskType.TASK);
    t.type = TaskType.BUG;
    expect(t.type).toBe(TaskType.BUG);
    t.type = TaskType.INCIDENT;
    expect(t.type).toBe(TaskType.INCIDENT);
    t.type = TaskType.FEATURE;
    expect(t.type).toBe(TaskType.FEATURE);
  });

  it('has type column with varchar type and default of TaskType.TASK', () => {
    const col = ownColumns(TaskEntity).find((c) => c.propertyName === 'type');
    expect(col).toBeDefined();
    expect(col?.options.type).toBe('varchar');
    expect(col?.options.default).toBe(TaskType.TASK);
  });

  it('has dueDate nullable column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'dueDate',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has startDate nullable column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'startDate',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has estimatedHours nullable column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'estimatedHours',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has parentTaskId nullable column (self-FK)', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'parentTaskId',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has rank text column', () => {
    const col = ownColumns(TaskEntity).find((c) => c.propertyName === 'rank');
    expect(col).toBeDefined();
  });

  it('has customFields jsonb column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'customFields',
    );
    expect(col).toBeDefined();
    expect(col?.options.type).toBe('jsonb');
  });

  it('has completedAt nullable column', () => {
    const col = ownColumns(TaskEntity).find(
      (c) => c.propertyName === 'completedAt',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has self-referential ManyToOne relation (parentTaskId ON DELETE SET NULL)', () => {
    const storage = getMetadataArgsStorage();
    const rel = storage.relations.find(
      (r) => r.target === TaskEntity && r.propertyName === 'parent',
    );
    expect(rel).toBeDefined();
    expect(rel?.relationType).toBe('many-to-one');
    expect(rel?.options?.onDelete).toBe('SET NULL');
  });

  it('inherits workspaceId from TenantEntity', () => {
    const t = new TaskEntity();
    t.workspaceId = 'ws-uuid-1';
    expect(t.workspaceId).toBe('ws-uuid-1');
  });
});
