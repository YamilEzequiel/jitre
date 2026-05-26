import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  TaskUnassignedEvent,
  TaskCompletedEvent,
  TaskDeletedEvent,
  TaskLabelAddedEvent,
  TaskLabelRemovedEvent,
  TaskDueSoonEvent,
} from './index';

const BASE = {
  aggregateId: 'task-1',
  aggregateType: 'Task',
  workspaceId: 'ws-1',
  actorUserId: 'user-1',
};

describe('Task domain events', () => {
  it('TaskCreatedEvent has name "task.created"', () => {
    const e = new TaskCreatedEvent({
      ...BASE,
      payload: { taskId: 'task-1', projectId: 'proj-1', title: 'My Task' },
    });
    expect(e.name).toBe('task.created');
  });

  it('TaskUpdatedEvent has name "task.updated"', () => {
    const e = new TaskUpdatedEvent({
      ...BASE,
      payload: {
        taskId: 'task-1',
        projectId: 'proj-1',
        changes: { title: 'New Title' },
      },
    });
    expect(e.name).toBe('task.updated');
  });

  it('TaskStatusChangedEvent has name "task.status_changed"', () => {
    const e = new TaskStatusChangedEvent({
      ...BASE,
      payload: {
        taskId: 'task-1',
        projectId: 'proj-1',
        previousStatusId: 'status-1',
        newStatusId: 'status-2',
        newCategory: 'in_progress',
      },
    });
    expect(e.name).toBe('task.status_changed');
  });

  it('TaskAssignedEvent has name "task.assigned"', () => {
    const e = new TaskAssignedEvent({
      ...BASE,
      payload: {
        taskId: 'task-1',
        projectId: 'proj-1',
        assigneeUserId: 'user-2',
      },
    });
    expect(e.name).toBe('task.assigned');
  });

  it('TaskUnassignedEvent has name "task.unassigned"', () => {
    const e = new TaskUnassignedEvent({
      ...BASE,
      payload: {
        taskId: 'task-1',
        projectId: 'proj-1',
        assigneeUserId: 'user-2',
      },
    });
    expect(e.name).toBe('task.unassigned');
  });

  it('TaskCompletedEvent has name "task.completed"', () => {
    const e = new TaskCompletedEvent({
      ...BASE,
      payload: {
        taskId: 'task-1',
        projectId: 'proj-1',
        completedAt: new Date().toISOString(),
      },
    });
    expect(e.name).toBe('task.completed');
  });

  it('TaskDeletedEvent has name "task.deleted"', () => {
    const e = new TaskDeletedEvent({
      ...BASE,
      payload: { taskId: 'task-1', projectId: 'proj-1' },
    });
    expect(e.name).toBe('task.deleted');
  });

  it('TaskLabelAddedEvent has name "task.label.added"', () => {
    const e = new TaskLabelAddedEvent({
      ...BASE,
      payload: { taskId: 'task-1', projectId: 'proj-1', labelId: 'label-1' },
    });
    expect(e.name).toBe('task.label.added');
  });

  it('TaskLabelRemovedEvent has name "task.label.removed"', () => {
    const e = new TaskLabelRemovedEvent({
      ...BASE,
      payload: { taskId: 'task-1', projectId: 'proj-1', labelId: 'label-1' },
    });
    expect(e.name).toBe('task.label.removed');
  });

  it('TaskDueSoonEvent has name "task.due_soon"', () => {
    const e = new TaskDueSoonEvent({
      ...BASE,
      payload: {
        taskId: 'task-1',
        projectId: 'proj-1',
        dueDate: new Date().toISOString(),
        assigneeUserIds: ['user-2'],
      },
    });
    expect(e.name).toBe('task.due_soon');
  });
});
