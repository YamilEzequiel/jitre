import { IndexerListener } from './indexer.listener';
import { JOB_NAMES } from '../jobs/queues.constants';

describe('IndexerListener', () => {
  let listener: IndexerListener;
  let mockQueue: { add: jest.Mock };
  let taskLabelRepo: { find: jest.Mock };
  const domainEvent = <T>(payload: T) => ({ workspaceId: 'W1', payload });

  beforeEach(() => {
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) };
    taskLabelRepo = { find: jest.fn().mockResolvedValue([]) };
    listener = new IndexerListener(mockQueue as never, taskLabelRepo as never);
  });

  // --- Existing Fase 5 handlers (must remain working) ---
  it('comment.created → enqueues entity.index with action upsert', async () => {
    await listener.onCommentCreated(domainEvent({ commentId: 'C1' }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'comment',
      entityId: 'C1',
      action: 'upsert',
    });
  });

  it('comment.updated → enqueues entity.index with action upsert', async () => {
    await listener.onCommentUpdated(domainEvent({ commentId: 'C1' }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'comment',
      entityId: 'C1',
      action: 'upsert',
    });
  });

  it('comment.deleted → enqueues entity.index with action delete', async () => {
    await listener.onCommentDeleted(domainEvent({ commentId: 'C1' }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'comment',
      entityId: 'C1',
      action: 'delete',
    });
  });

  it('workspace.created → enqueues entity.index with action upsert', async () => {
    await listener.onWorkspaceCreated({ workspaceId: 'W1' });
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'workspace',
      entityId: 'W1',
      action: 'upsert',
    });
  });

  it('user.profile.updated → enqueues entity.index with action upsert', async () => {
    await listener.onUserProfileUpdated({ userId: 'U1', workspaceId: 'W1' });
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'user',
      entityId: 'U1',
      action: 'upsert',
    });
  });

  // --- New Fase 6 handlers: Task events ---
  it('task.created → enqueues entity.index for task with action upsert', async () => {
    await listener.onTaskCreated(domainEvent({
      taskId: 'T1',
      projectId: 'P1',
      title: 'Fix',
    }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'task',
      entityId: 'T1',
      action: 'upsert',
    });
  });

  it('task.updated → enqueues entity.index for task with action upsert', async () => {
    await listener.onTaskUpdated(domainEvent({
      taskId: 'T1',
      projectId: 'P1',
      changes: {},
    }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'task',
      entityId: 'T1',
      action: 'upsert',
    });
  });

  it('task.deleted → enqueues entity.index for task with action delete', async () => {
    await listener.onTaskDeleted(domainEvent({
      taskId: 'T1',
      projectId: 'P1',
    }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'task',
      entityId: 'T1',
      action: 'delete',
    });
  });

  // --- New Fase 6 handlers: Project events ---
  it('project.created → enqueues entity.index for project with action upsert', async () => {
    await listener.onProjectCreated(domainEvent({
      projectId: 'P1',
      name: 'Test',
      key: 'TEST',
      ownerUserId: 'U1',
    }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'project',
      entityId: 'P1',
      action: 'upsert',
    });
  });

  it('project.updated → enqueues entity.index for project with action upsert', async () => {
    await listener.onProjectUpdated(domainEvent({
      projectId: 'P1',
      changes: {},
    }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'project',
      entityId: 'P1',
      action: 'upsert',
    });
  });

  it('project.archived → enqueues entity.index for project with action delete (tombstone)', async () => {
    await listener.onProjectArchived(domainEvent({ projectId: 'P1' }));
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'project',
      entityId: 'P1',
      action: 'delete',
    });
  });

  // --- label.updated fan-out ---
  it('label.updated → fans out re-index jobs for each task carrying that label', async () => {
    taskLabelRepo.find.mockResolvedValue([
      { taskId: 'T1', workspaceId: 'W1' },
      { taskId: 'T2', workspaceId: 'W1' },
    ]);

    await listener.onLabelUpdated(domainEvent({
      labelId: 'L1',
      changes: { name: 'NewName' },
    }));

    expect(taskLabelRepo.find).toHaveBeenCalledWith({
      where: { labelId: 'L1' },
    });
    expect(mockQueue.add).toHaveBeenCalledTimes(2);
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'task',
      entityId: 'T1',
      action: 'upsert',
    });
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'task',
      entityId: 'T2',
      action: 'upsert',
    });
  });

  it('label.updated → no queue calls when no tasks carry that label', async () => {
    taskLabelRepo.find.mockResolvedValue([]);

    await listener.onLabelUpdated(domainEvent({
      labelId: 'L1',
      changes: {},
    }));

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('document.created and document.updated enqueue document upserts', async () => {
    await listener.onDocumentUpsert(domainEvent({ documentId: 'D1' }));
    await listener.onDocumentUpsert(domainEvent({ documentId: 'D1' }));

    expect(mockQueue.add).toHaveBeenNthCalledWith(1, JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'document',
      entityId: 'D1',
      action: 'upsert',
    });
    expect(mockQueue.add).toHaveBeenNthCalledWith(2, JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'document',
      entityId: 'D1',
      action: 'upsert',
    });
  });

  it('document.deleted removes the page and cascaded child documents from search', async () => {
    await listener.onDocumentDeleted(
      domainEvent({ documentId: 'D1', cascadedChildIds: ['D2', 'D3'] }),
    );

    expect(mockQueue.add).toHaveBeenCalledTimes(3);
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'document',
      entityId: 'D1',
      action: 'delete',
    });
    expect(mockQueue.add).toHaveBeenCalledWith(JOB_NAMES.ENTITY_INDEX, {
      workspaceId: 'W1',
      entityType: 'document',
      entityId: 'D2',
      action: 'delete',
    });
  });
});
