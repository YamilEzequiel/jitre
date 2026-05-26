import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiOperation } from '@jitre/shared';
import { AiService } from './ai.service';
import { AiQuotaGuard } from './ai-quota.guard';
import { SettingsService } from '../settings/settings.service';
import { RequestContextService } from '../request-context/request-context.service';
import { DescribeTaskDto } from './dto/describe-task.dto';
import { SuggestSubtasksDto } from './dto/suggest-subtasks.dto';
import { SummarizeCommentsDto } from './dto/summarize-comments.dto';
import { AiFeatureDisabledException } from './exceptions/ai-feature-disabled.exception';
import { AiResponseInvalidException } from './exceptions/ai-response-invalid.exception';
import { buildDescribeTaskPrompt } from './prompts/describe-task.prompt';
import {
  buildSuggestSubtasksPrompt,
  parseSubtasksResponse,
} from './prompts/suggest-subtasks.prompt';
import { buildSummaryPrompt } from './prompts/summary.prompt';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@UseGuards(AiQuotaGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly settings: SettingsService,
    private readonly requestContext: RequestContextService,
    @Inject('TaskService')
    private readonly taskService: {
      getById(id: string, projectId?: string, workspaceId?: string): Promise<{
        id: string;
        title: string;
        description: string | null;
        projectId: string;
        workspaceId: string;
      }>;
      update(
        id: string,
        data: { description?: string },
        projectId?: string,
        workspaceId?: string,
      ): Promise<unknown>;
    },
    @Inject('CommentService')
    private readonly commentService: {
      findByIds(
        ids: string[],
        opts: { workspaceId: string },
      ): Promise<
        { id: string; body: string; userId: string; createdAt: Date }[]
      >;
    },
  ) {}

  @ApiOperation({ summary: 'Generate AI description for a task' })
  @ApiResponse({ status: 200, description: 'Description generated.' })
  @ApiResponse({
    status: 403,
    description: 'Feature disabled or no use_ai permission.',
  })
  @ApiResponse({ status: 429, description: 'Quota exceeded.' })
  @Post('tasks/:taskId/describe')
  async describeTask(
    @Param('taskId') taskId: string,
    @Body() dto: Partial<DescribeTaskDto>,
  ): Promise<{
    description: string;
    applied: boolean;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: string;
      model: string;
    };
  }> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;

    // Feature gate check
    const featureEnabled = await this.settings.getAiSetting<boolean>(
      workspaceId,
      'ai.task_describe_enabled',
      true,
    );
    if (!featureEnabled)
      throw new AiFeatureDisabledException('ai.task_describe_enabled');

    // Load task
    const task = await this.taskService.getById(taskId, undefined, workspaceId);

    // Build prompt
    const { systemPrompt, userPrompt } = buildDescribeTaskPrompt({
      taskTitle: task.title,
      currentDescription: task.description,
      tone: dto.tone ?? 'technical',
    });

    // Call AI
    const response = await this.aiService.generateCompletion({
      workspaceId,
      userId,
      operation: AiOperation.DESCRIBE,
      request: { systemPrompt, userPrompt, maxTokens: 600 },
    });

    // Optionally apply to task
    const applyToTask = dto.applyToTask !== false;
    if (applyToTask) {
      await this.taskService.update(taskId, { description: response.text }, undefined, workspaceId);
    }

    return {
      description: response.text,
      applied: applyToTask,
      usage: {
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        costUsd: response.costUsd,
        model: response.model,
      },
    };
  }

  @ApiOperation({ summary: 'Suggest subtasks for a task using AI' })
  @ApiResponse({ status: 200, description: 'Subtasks suggested.' })
  @ApiResponse({ status: 403, description: 'Feature disabled.' })
  @ApiResponse({ status: 429, description: 'Quota exceeded.' })
  @ApiResponse({ status: 502, description: 'AI response could not be parsed.' })
  @Post('tasks/:taskId/suggest-subtasks')
  async suggestSubtasks(
    @Param('taskId') taskId: string,
    @Body() dto: Partial<SuggestSubtasksDto>,
  ): Promise<{
    subtasks: { title: string; description?: string }[];
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: string;
      model: string;
    };
  }> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;
    const maxSuggestions = dto.maxSuggestions ?? 5;

    // Feature gate
    const featureEnabled = await this.settings.getAiSetting<boolean>(
      workspaceId,
      'ai.subtask_suggest_enabled',
      true,
    );
    if (!featureEnabled)
      throw new AiFeatureDisabledException('ai.subtask_suggest_enabled');

    // Load task
    const task = await this.taskService.getById(taskId, undefined, workspaceId);

    // Build prompt (JSON mode)
    const { systemPrompt, userPrompt } = buildSuggestSubtasksPrompt({
      taskTitle: task.title,
      taskDescription: task.description,
      maxSuggestions,
    });

    // Call AI
    const response = await this.aiService.generateCompletion({
      workspaceId,
      userId,
      operation: AiOperation.SUGGEST_SUBTASKS,
      request: {
        systemPrompt,
        userPrompt,
        responseFormat: 'json',
        maxTokens: 1000,
      },
    });

    // Parse response
    const subtasks = parseSubtasksResponse(response.text, maxSuggestions);
    if (subtasks.length === 0) {
      throw new AiResponseInvalidException(
        'neither JSON nor markdown bullets found in response',
      );
    }

    return {
      subtasks,
      usage: {
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        costUsd: response.costUsd,
        model: response.model,
      },
    };
  }

  @ApiOperation({ summary: 'Summarize comments using AI' })
  @ApiResponse({ status: 200, description: 'Summary generated.' })
  @ApiResponse({ status: 400, description: 'Less than 2 readable comments.' })
  @ApiResponse({ status: 403, description: 'Feature disabled.' })
  @ApiResponse({ status: 429, description: 'Quota exceeded.' })
  @Post('comments/summary')
  async summarizeComments(
    @Body() dto: Pick<SummarizeCommentsDto, 'commentIds'>,
  ): Promise<{
    summary: string;
    commentCount: number;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: string;
      model: string;
    };
  }> {
    const workspaceId = this.requestContext.getWorkspaceId()!;
    const userId = this.requestContext.getUserId()!;

    // Feature gate
    const featureEnabled = await this.settings.getAiSetting<boolean>(
      workspaceId,
      'ai.comment_summary_enabled',
      true,
    );
    if (!featureEnabled)
      throw new AiFeatureDisabledException('ai.comment_summary_enabled');

    // Load + filter comments
    const comments = await this.commentService.findByIds(dto.commentIds, {
      workspaceId,
    });
    if (comments.length < 2) {
      throw new BadRequestException({
        message: 'At least 2 readable comments are required for summarization.',
        code: 'INSUFFICIENT_READABLE_COMMENTS',
      });
    }

    // Build prompt
    const { systemPrompt, userPrompt } = buildSummaryPrompt(
      comments.map((c) => ({
        authorId: c.userId,
        body: c.body,
        createdAt: c.createdAt,
      })),
    );

    // Call AI
    const response = await this.aiService.generateCompletion({
      workspaceId,
      userId,
      operation: AiOperation.SUMMARY,
      request: { systemPrompt, userPrompt, maxTokens: 600 },
    });

    return {
      summary: response.text,
      commentCount: comments.length,
      usage: {
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        costUsd: response.costUsd,
        model: response.model,
      },
    };
  }
}
