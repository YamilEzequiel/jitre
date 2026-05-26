import { IndexEntityProcessor } from './index-entity.processor';

const makeJob = (data: Record<string, unknown>) =>
  ({ data, attemptsMade: 0, id: 'job-1' }) as unknown as import('bullmq').Job;

describe('IndexEntityProcessor', () => {
  let processor: IndexEntityProcessor;
  let commentRepo: { findOne: jest.Mock };
  let workspaceRepo: { findOne: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let taskRepo: { findOne: jest.Mock };
  let projectRepo: { findOne: jest.Mock };
  let documentRepo: { findOne: jest.Mock };
  let taskLabelRepo: { find: jest.Mock };
  let searchService: { upsert: jest.Mock; delete: jest.Mock };

  beforeEach(() => {
    commentRepo = { findOne: jest.fn() };
    workspaceRepo = { findOne: jest.fn() };
    userRepo = { findOne: jest.fn() };
    taskRepo = { findOne: jest.fn() };
    projectRepo = { findOne: jest.fn() };
    documentRepo = { findOne: jest.fn() };
    taskLabelRepo = { find: jest.fn().mockResolvedValue([]) };
    searchService = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    processor = new IndexEntityProcessor(
      commentRepo as never,
      workspaceRepo as never,
      userRepo as never,
      taskRepo as never,
      projectRepo as never,
      documentRepo as never,
      taskLabelRepo as never,
      searchService,
    );
  });

  describe('action: upsert', () => {
    it('loads comment, builds content, calls searchService.upsert', async () => {
      const comment = {
        id: 'C1',
        workspaceId: 'W1',
        body: 'hello @alice world',
      };
      commentRepo.findOne.mockResolvedValue(comment);

      const result = await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'comment',
          entityId: 'C1',
          action: 'upsert',
        }),
      );

      expect(searchService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'W1',
          entityType: 'comment',
          entityId: 'C1',
          content: expect.stringContaining('hello @alice world'),
        }),
      );
      expect(result).toBeUndefined();
    });

    it('returns { skipped: entity_missing } when entity not found', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      const result = await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'comment',
          entityId: 'C99',
          action: 'upsert',
        }),
      );

      expect(result).toEqual({ skipped: 'entity_missing' });
      expect(searchService.upsert).not.toHaveBeenCalled();
    });

    it('upserts a task entity with title + description + label names in content', async () => {
      const task = {
        id: 'T1',
        workspaceId: 'W1',
        title: 'Fix bug',
        description: 'Details here',
      };
      taskRepo.findOne.mockResolvedValue(task);
      taskLabelRepo.find.mockResolvedValue([
        { taskId: 'T1', label: { name: 'Backend' } },
        { taskId: 'T1', label: { name: 'Critical' } },
      ]);

      await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'task',
          entityId: 'T1',
          action: 'upsert',
        }),
      );

      expect(searchService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'task',
          entityId: 'T1',
          content: expect.stringContaining('Fix bug'),
        }),
      );
      const call = searchService.upsert.mock.calls[0]?.[0];
      expect(call.content).toContain('Details here');
      expect(call.content).toContain('Backend');
      expect(call.content).toContain('Critical');
    });

    it('upserts a project entity with name + description + key in content', async () => {
      const project = {
        id: 'P1',
        workspaceId: 'W1',
        name: 'Jitre',
        key: 'JITRE',
        description: 'Project desc',
      };
      projectRepo.findOne.mockResolvedValue(project);

      await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'project',
          entityId: 'P1',
          action: 'upsert',
        }),
      );

      expect(searchService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'project',
          entityId: 'P1',
          content: expect.stringContaining('Jitre'),
        }),
      );
      const call = searchService.upsert.mock.calls[0]?.[0];
      expect(call.content).toContain('JITRE');
      expect(call.content).toContain('Project desc');
    });

    it('upserts a document entity using title and flattened text content', async () => {
      documentRepo.findOne.mockResolvedValue({
        id: 'D1',
        workspaceId: 'W1',
        title: 'Release notes',
        contentText: 'Version two ships today',
      });

      await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'document',
          entityId: 'D1',
          action: 'upsert',
        }),
      );

      expect(searchService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'document',
          entityId: 'D1',
          content: 'Release notes Version two ships today',
        }),
      );
    });
  });

  describe('action: delete', () => {
    it('calls searchService.delete with correct args', async () => {
      const result = await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'comment',
          entityId: 'C1',
          action: 'delete',
        }),
      );

      expect(searchService.delete).toHaveBeenCalledWith('W1', 'comment', 'C1');
      expect(result).toBeUndefined();
    });

    it('tombstones a task on task.deleted', async () => {
      await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'task',
          entityId: 'T1',
          action: 'delete',
        }),
      );
      expect(searchService.delete).toHaveBeenCalledWith('W1', 'task', 'T1');
    });

    it('tombstones a project on project.archived', async () => {
      await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'project',
          entityId: 'P1',
          action: 'delete',
        }),
      );
      expect(searchService.delete).toHaveBeenCalledWith('W1', 'project', 'P1');
    });

    it('tombstones a document on document.deleted', async () => {
      await processor.process(
        makeJob({
          workspaceId: 'W1',
          entityType: 'document',
          entityId: 'D1',
          action: 'delete',
        }),
      );
      expect(searchService.delete).toHaveBeenCalledWith('W1', 'document', 'D1');
    });
  });

  describe('buildContent()', () => {
    it('comment: returns body', () => {
      const content = processor.buildContent('comment', {
        body: 'hello world',
      });
      expect(content).toBe('hello world');
    });

    it('workspace: returns name slug description', () => {
      const content = processor.buildContent('workspace', {
        name: 'My WS',
        slug: 'my-ws',
        description: 'A workspace',
      });
      expect(content).toBe('My WS my-ws A workspace');
    });

    it('user: returns email displayName username', () => {
      const content = processor.buildContent('user', {
        email: 'a@b.com',
        displayName: 'Alice',
        username: 'alice',
      });
      expect(content).toBe('a@b.com Alice alice');
    });

    it('workspace: empty description replaced with empty string', () => {
      const content = processor.buildContent('workspace', {
        name: 'W1',
        slug: 'w1',
        description: null,
      });
      expect(content).toBe('W1 w1 ');
    });

    it('task: returns title + description + denormalized label names', () => {
      const content = processor.buildContent('task', {
        title: 'Fix bug',
        description: 'With details',
        labelNames: ['Backend', 'Critical'],
      });
      expect(content).toContain('Fix bug');
      expect(content).toContain('With details');
      expect(content).toContain('Backend');
      expect(content).toContain('Critical');
    });

    it('project: returns name + description + key', () => {
      const content = processor.buildContent('project', {
        name: 'Jitre',
        description: 'The project',
        key: 'JITRE',
      });
      expect(content).toBe('Jitre JITRE The project');
    });

    it('document: returns title and flattened editor content', () => {
      const content = processor.buildContent('document', {
        title: 'Runbook',
        contentText: 'Escalate production incidents',
      });
      expect(content).toBe('Runbook Escalate production incidents');
    });
  });
});
