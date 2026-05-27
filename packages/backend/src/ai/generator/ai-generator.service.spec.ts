import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiGeneratorService } from './ai-generator.service';
import { AiService } from '../ai.service';
import { StatusService } from '../../project/status/status.service';
import { DocumentService } from '../../document/document.service';
import { ProjectService } from '../../project/project.service';
import { AiResponseInvalidException } from '../exceptions/ai-response-invalid.exception';

const aiMock = { generateCompletion: jest.fn() };
const statusMock = { listByProject: jest.fn() };
const taskMock = { create: jest.fn() };
const documentMock = { create: jest.fn() };
const projectMock = { create: jest.fn() };

describe('AiGeneratorService', () => {
  let service: AiGeneratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AiGeneratorService,
        { provide: AiService, useValue: aiMock },
        { provide: StatusService, useValue: statusMock },
        { provide: 'TaskService', useValue: taskMock },
        { provide: DocumentService, useValue: documentMock },
        { provide: ProjectService, useValue: projectMock },
      ],
    }).compile();

    service = module.get(AiGeneratorService);
  });

  describe('draft()', () => {
    it('returns the parsed draft and surfaces model + cost from the AI response', async () => {
      aiMock.generateCompletion.mockResolvedValueOnce({
        text: JSON.stringify({ kind: 'task', title: 'Ship docs' }),
        model: 'gemini-2.0-flash',
        costUsd: '0.000123',
        promptTokens: 20,
        completionTokens: 5,
        totalTokens: 25,
        finishReason: 'stop',
      });

      const result = await service.draft({
        workspaceId: 'W1',
        userId: 'U1',
        prompt: 'we need to ship the docs',
      });

      expect(result.drafts).toHaveLength(1);
      expect(result.drafts[0].kind).toBe('task');
      expect(result.model).toBe('gemini-2.0-flash');
      expect(result.costUsd).toBe('0.000123');
    });

    it('applies the context projectId when the LLM did not infer one', async () => {
      aiMock.generateCompletion.mockResolvedValueOnce({
        text: JSON.stringify({ kind: 'task', title: 'Whatever' }),
        model: 'm',
        costUsd: '0',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        finishReason: 'stop',
      });

      const result = await service.draft({
        workspaceId: 'W1',
        userId: 'U1',
        prompt: 'noise',
        projectId: 'P-ctx',
      });

      expect(result.drafts[0].projectId).toBe('P-ctx');
    });

    it('keeps the LLM-inferred projectId over the context one', async () => {
      aiMock.generateCompletion.mockResolvedValueOnce({
        text: JSON.stringify({ kind: 'task', title: 'X', projectId: 'P-llm' }),
        model: 'm',
        costUsd: '0',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        finishReason: 'stop',
      });

      const result = await service.draft({
        workspaceId: 'W1',
        userId: 'U1',
        prompt: 'X',
        projectId: 'P-ctx',
      });

      expect(result.drafts[0].projectId).toBe('P-llm');
    });

    it('wraps parser errors as AiResponseInvalidException (502)', async () => {
      aiMock.generateCompletion.mockResolvedValueOnce({
        text: 'not even close to JSON',
        model: 'm',
        costUsd: '0',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        finishReason: 'stop',
      });

      await expect(
        service.draft({ workspaceId: 'W1', userId: 'U1', prompt: 'bad' }),
      ).rejects.toThrow(AiResponseInvalidException);
    });
  });

  describe('commit()', () => {
    it('rejects task commit without a projectId', async () => {
      await expect(
        service.commit({
          workspaceId: 'W1',
          userId: 'U1',
          draft: { kind: 'task', title: 'no project' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects commit when the project has no statuses to anchor the task', async () => {
      statusMock.listByProject.mockResolvedValueOnce([]);
      await expect(
        service.commit({
          workspaceId: 'W1',
          userId: 'U1',
          draft: { kind: 'task', title: 'X', projectId: 'P1' },
        }),
      ).rejects.toThrow(/PROJECT_HAS_NO_STATUSES/);
    });

    it('creates a single task with the first available status', async () => {
      statusMock.listByProject.mockResolvedValueOnce([
        { id: 'S-todo' },
        { id: 'S-doing' },
      ]);
      taskMock.create.mockResolvedValueOnce({ id: 'T1' });

      const result = await service.commit({
        workspaceId: 'W1',
        userId: 'U1',
        draft: { kind: 'task', title: 'Ship', projectId: 'P1' },
      });

      expect(taskMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'W1',
          projectId: 'P1',
          statusId: 'S-todo',
          title: 'Ship',
          actorUserId: 'U1',
        }),
      );
      expect(result).toEqual({ kind: 'task', id: 'T1' });
    });

    it('creates parent + subtasks linked by parentTaskId', async () => {
      statusMock.listByProject.mockResolvedValueOnce([{ id: 'S-todo' }]);
      taskMock.create
        .mockResolvedValueOnce({ id: 'PARENT' })
        .mockResolvedValueOnce({ id: 'C1' })
        .mockResolvedValueOnce({ id: 'C2' });

      const result = await service.commit({
        workspaceId: 'W1',
        userId: 'U1',
        draft: {
          kind: 'task_with_subtasks',
          projectId: 'P1',
          parent: { title: 'Epic' },
          subtasks: [{ title: 'Step 1' }, { title: 'Step 2' }],
        },
      });

      expect(taskMock.create).toHaveBeenCalledTimes(3);
      expect(taskMock.create.mock.calls[1][0]).toEqual(
        expect.objectContaining({ parentTaskId: 'PARENT', title: 'Step 1' }),
      );
      expect(taskMock.create.mock.calls[2][0]).toEqual(
        expect.objectContaining({ parentTaskId: 'PARENT', title: 'Step 2' }),
      );
      expect(result).toEqual({ kind: 'task_with_subtasks', id: 'PARENT', childIds: ['C1', 'C2'] });
    });

    it('creates a doc and wraps the body in a Quill delta', async () => {
      documentMock.create.mockResolvedValueOnce({ id: 'D1' });

      const result = await service.commit({
        workspaceId: 'W1',
        userId: 'U1',
        isWorkspaceAdmin: false,
        draft: {
          kind: 'doc',
          title: 'Onboarding',
          icon: '📘',
          body: 'Step one.\n\nStep two.',
          projectId: 'P1',
        },
      });

      expect(documentMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'W1',
          actorUserId: 'U1',
          isWorkspaceAdmin: false,
          title: 'Onboarding',
          icon: '📘',
          projectId: 'P1',
        }),
      );
      const payload = documentMock.create.mock.calls[0][0] as {
        content: { ops: Array<{ insert: string }> };
      };
      expect(payload.content.ops.length).toBeGreaterThan(0);
      expect(payload.content.ops[0].insert).toContain('Step one');
      expect(result).toEqual({ kind: 'doc', id: 'D1' });
    });

    it('creates a workspace-level doc when projectId is null', async () => {
      documentMock.create.mockResolvedValueOnce({ id: 'D2' });

      await service.commit({
        workspaceId: 'W1',
        userId: 'U1',
        draft: { kind: 'doc', title: 'Notes' },
      });

      expect(documentMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: null }),
      );
    });

    it('creates a project with the current user as owner', async () => {
      projectMock.create.mockResolvedValueOnce({ id: 'P-new' });

      const result = await service.commit({
        workspaceId: 'W1',
        userId: 'U1',
        draft: {
          kind: 'project',
          name: 'Atlas',
          key: 'ATL',
          description: 'Cool stuff',
          icon: '🚀',
          color: '#6366F1',
        },
      });

      expect(projectMock.create).toHaveBeenCalledWith({
        workspaceId: 'W1',
        ownerUserId: 'U1',
        name: 'Atlas',
        key: 'ATL',
        description: 'Cool stuff',
        icon: '🚀',
        color: '#6366F1',
      });
      expect(result).toEqual({ kind: 'project', id: 'P-new' });
    });
  });
});
