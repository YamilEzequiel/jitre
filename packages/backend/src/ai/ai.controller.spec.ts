import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiQuotaGuard } from './ai-quota.guard';
import { SettingsService } from '../settings/settings.service';
import { RequestContextService } from '../request-context/request-context.service';
import { AiOperation } from '@jitre/shared';
import { AiFeatureDisabledException } from './exceptions/ai-feature-disabled.exception';
import { AiResponseInvalidException } from './exceptions/ai-response-invalid.exception';

const mockAiService = {
  generateCompletion: jest.fn(),
};

const mockSettings = {
  getAiSetting: jest.fn(),
};

const mockRequestContext = {
  getWorkspaceId: jest.fn().mockReturnValue('ws-1'),
  getUserId: jest.fn().mockReturnValue('u-1'),
};

const mockTaskService = {
  getById: jest.fn(),
  update: jest.fn(),
};

const mockCommentService = {
  findByIds: jest.fn(),
};

// Mock guards to always pass
jest.mock('../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

describe('AiController', () => {
  let controller: AiController;

  const mockTask = {
    id: 'task-1',
    title: 'Test task',
    description: null,
    projectId: 'proj-1',
    workspaceId: 'ws-1',
  };

  const mockResponse = {
    text: 'AI generated description',
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    model: 'gemini-2.0-flash-exp',
    finishReason: 'stop',
    costUsd: '0.000225',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettings.getAiSetting.mockResolvedValue(true); // features enabled by default

    const module = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: mockAiService },
        { provide: SettingsService, useValue: mockSettings },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: 'TaskService', useValue: mockTaskService },
        { provide: 'CommentService', useValue: mockCommentService },
        {
          provide: AiQuotaGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(AiQuotaGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AiController);
  });

  describe('POST /ai/tasks/:taskId/describe', () => {
    it('returns description + usage on happy path', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockAiService.generateCompletion.mockResolvedValue(mockResponse);
      mockTaskService.update.mockResolvedValue({
        ...mockTask,
        description: mockResponse.text,
      });

      const result = await controller.describeTask('task-1', {});

      expect(result).toMatchObject({
        description: mockResponse.text,
        applied: true,
        usage: expect.objectContaining({ costUsd: '0.000225' }),
      });
    });

    it('does not update task when applyToTask=false', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockAiService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await controller.describeTask('task-1', {
        applyToTask: false,
      });

      expect(result.applied).toBe(false);
      expect(mockTaskService.update).not.toHaveBeenCalled();
    });

    it('calls generateCompletion with DESCRIBE operation', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockAiService.generateCompletion.mockResolvedValue(mockResponse);
      mockTaskService.update.mockResolvedValue({});

      await controller.describeTask('task-1', {});

      expect(mockAiService.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ operation: AiOperation.DESCRIBE }),
      );
    });

    it('throws NotFoundException when task not found', async () => {
      mockTaskService.getById.mockRejectedValue(
        new NotFoundException('Task not found'),
      );

      await expect(
        controller.describeTask('invalid-task', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws AiFeatureDisabledException when feature disabled', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockSettings.getAiSetting.mockResolvedValue(false); // feature disabled

      await expect(
        controller.describeTask('task-1', {}),
      ).rejects.toBeInstanceOf(AiFeatureDisabledException);
    });
  });

  describe('POST /ai/tasks/:taskId/suggest-subtasks', () => {
    it('returns parsed subtasks on happy path', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockAiService.generateCompletion.mockResolvedValue({
        ...mockResponse,
        text: JSON.stringify({
          subtasks: [{ title: 'Subtask 1' }, { title: 'Subtask 2' }],
        }),
      });

      const result = await controller.suggestSubtasks('task-1', {});

      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].title).toBe('Subtask 1');
    });

    it('uses lenient markdown fallback on JSON parse failure', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockAiService.generateCompletion.mockResolvedValue({
        ...mockResponse,
        text: '- Subtask A\n- Subtask B\n- Subtask C',
      });

      const result = await controller.suggestSubtasks('task-1', {});
      expect(result.subtasks.length).toBeGreaterThanOrEqual(3);
    });

    it('throws AiResponseInvalidException when both JSON and markdown fail', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockAiService.generateCompletion.mockResolvedValue({
        ...mockResponse,
        text: 'I cannot generate subtasks for this.',
      });

      await expect(
        controller.suggestSubtasks('task-1', {}),
      ).rejects.toBeInstanceOf(AiResponseInvalidException);
    });

    it('does not auto-create subtasks', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockAiService.generateCompletion.mockResolvedValue({
        ...mockResponse,
        text: JSON.stringify({ subtasks: [{ title: 'Sub 1' }] }),
      });

      await controller.suggestSubtasks('task-1', {});

      // taskService.create should NOT have been called
      expect(mockTaskService.update).not.toHaveBeenCalled();
    });

    it('throws AiFeatureDisabledException when feature disabled', async () => {
      mockTaskService.getById.mockResolvedValue(mockTask);
      mockSettings.getAiSetting.mockResolvedValue(false);

      await expect(
        controller.suggestSubtasks('task-1', {}),
      ).rejects.toBeInstanceOf(AiFeatureDisabledException);
    });
  });

  describe('POST /ai/comments/summary', () => {
    it('returns summary on happy path', async () => {
      const comments = [
        {
          id: 'c-1',
          body: 'First comment',
          userId: 'u-1',
          createdAt: new Date(),
        },
        {
          id: 'c-2',
          body: 'Second comment',
          userId: 'u-2',
          createdAt: new Date(),
        },
      ];
      mockCommentService.findByIds.mockResolvedValue(comments);
      mockAiService.generateCompletion.mockResolvedValue({
        ...mockResponse,
        text: 'Summary of discussion',
      });

      const result = await controller.summarizeComments({
        commentIds: ['c-1', 'c-2'],
      });

      expect(result.summary).toBe('Summary of discussion');
      expect(result.commentCount).toBe(2);
    });

    it('throws BadRequestException when readable comments < 2', async () => {
      mockCommentService.findByIds.mockResolvedValue([
        { id: 'c-1', body: 'Only one', userId: 'u-1', createdAt: new Date() },
      ]);

      await expect(
        controller.summarizeComments({ commentIds: ['c-1'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws AiFeatureDisabledException when feature disabled', async () => {
      mockSettings.getAiSetting.mockResolvedValue(false);
      mockCommentService.findByIds.mockResolvedValue([
        { id: 'c-1', body: 'Comment 1', userId: 'u-1', createdAt: new Date() },
        { id: 'c-2', body: 'Comment 2', userId: 'u-2', createdAt: new Date() },
      ]);

      await expect(
        controller.summarizeComments({ commentIds: ['c-1', 'c-2'] }),
      ).rejects.toBeInstanceOf(AiFeatureDisabledException);
    });
  });
});
