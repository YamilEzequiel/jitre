import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Logger,
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
import { SuggestTestCasesDto } from './dto/suggest-test-cases.dto';
import { SummarizeCommentsDto } from './dto/summarize-comments.dto';
import { AiFeatureDisabledException } from './exceptions/ai-feature-disabled.exception';
import { AiResponseInvalidException } from './exceptions/ai-response-invalid.exception';
import { buildDescribeTaskPrompt } from './prompts/describe-task.prompt';
import {
  buildSuggestSubtasksPrompt,
  parseSubtasksResponse,
} from './prompts/suggest-subtasks.prompt';
import {
  buildSuggestTestCasesPrompt,
  parseTestCasesResponse,
} from './prompts/suggest-test-cases.prompt';
import { buildSummaryPrompt } from './prompts/summary.prompt';
import { buildExplainTaskPrompt } from './prompts/explain-task.prompt';
import { resolveAiLocale } from './prompts/locale.util';
import { AiPromptTemplateService } from './prompt-template/ai-prompt-template.service';
import { TaskTestCaseService } from '../task/task-test-case.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@UseGuards(AiQuotaGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly settings: SettingsService,
    private readonly requestContext: RequestContextService,
    private readonly templates: AiPromptTemplateService,
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
    private readonly testCaseService: TaskTestCaseService,
  ) {}

  @ApiOperation({ summary: 'Generate AI description for a task' })
  @ApiResponse({ status: 200, description: 'Description generated.' })
  @ApiResponse({
    status: 403,
    description: 'Feature disabled or no use_ai permission.',
  })
  @ApiResponse({ status: 429, description: 'Quota / rate limit exceeded.' })
  // Tighter throttle on top of the global tiers + the AI quota guard:
  // 10 AI describe / 10s / IP and 30 / minute / IP. Real cost protection
  // still lives in AiQuotaGuard (per-workspace + per-user budget).
  @Throttle({ medium: { limit: 10, ttl: 10_000 }, long: { limit: 30, ttl: 60_000 } })
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

    // Resolve which template to use — DTO override, else workspace default, else null (= fallback)
    const template = dto.templateId
      ? await this.templates.getById(workspaceId, dto.templateId)
      : await this.templates.getDefaultFor(workspaceId, 'describe');

    const locale = await resolveAiLocale(this.settings, userId, workspaceId);

    // Build prompt (template if available, hard-coded fallback otherwise)
    const { systemPrompt, userPrompt } = buildDescribeTaskPrompt(
      {
        taskTitle: task.title,
        currentDescription: task.description,
        tone: dto.tone ?? 'technical',
        locale,
      },
      template,
    );

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

    // Resolve which template to use
    const template = dto.templateId
      ? await this.templates.getById(workspaceId, dto.templateId)
      : await this.templates.getDefaultFor(workspaceId, 'suggest_subtasks');

    const locale = await resolveAiLocale(this.settings, userId, workspaceId);

    // Build prompt (JSON mode)
    const { systemPrompt, userPrompt } = buildSuggestSubtasksPrompt(
      {
        taskTitle: task.title,
        taskDescription: task.description,
        maxSuggestions,
        locale,
      },
      template,
    );

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

  @ApiOperation({
    summary: 'Quick 2-sentence explanation of a task (used by the hover popover)',
  })
  @ApiResponse({ status: 200, description: 'Explanation generated.' })
  @ApiResponse({ status: 403, description: 'Feature disabled.' })
  @ApiResponse({ status: 429, description: 'Quota exceeded.' })
  @Post('tasks/:taskId/explain')
  async explainTask(
    @Param('taskId') taskId: string,
  ): Promise<{
    explanation: string;
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

    const featureEnabled = await this.settings.getAiSetting<boolean>(
      workspaceId,
      'ai.task_describe_enabled',
      true,
    );
    if (!featureEnabled) {
      throw new AiFeatureDisabledException('ai.task_describe_enabled');
    }

    const task = await this.taskService.getById(taskId, undefined, workspaceId);

    const locale = await resolveAiLocale(this.settings, userId, workspaceId);

    const { systemPrompt, userPrompt } = buildExplainTaskPrompt({
      taskTitle: task.title,
      taskDescription: task.description,
      locale,
    });

    const response = await this.aiService.generateCompletion({
      workspaceId,
      userId,
      operation: AiOperation.DESCRIBE,
      request: { systemPrompt, userPrompt, maxTokens: 160, temperature: 0.4 },
    });

    return {
      explanation: response.text.trim(),
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

    const locale = await resolveAiLocale(this.settings, userId, workspaceId);

    // Build prompt
    const { systemPrompt, userPrompt } = buildSummaryPrompt(
      comments.map((c) => ({
        authorId: c.userId,
        body: c.body,
        createdAt: c.createdAt,
      })),
      locale,
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

  @ApiOperation({ summary: 'Suggest structured test cases for a task using AI' })
  @ApiResponse({ status: 200, description: 'Test cases suggested.' })
  @ApiResponse({ status: 403, description: 'Feature disabled.' })
  @ApiResponse({ status: 429, description: 'Quota exceeded.' })
  @ApiResponse({ status: 502, description: 'AI response could not be parsed.' })
  @Post('tasks/:taskId/suggest-test-cases')
  async suggestTestCases(
    @Param('taskId') taskId: string,
    @Body() dto: Partial<SuggestTestCasesDto>,
  ): Promise<{
    testCases: {
      title: string;
      precondition?: string;
      steps?: string;
      expected?: string;
    }[];
    applied: boolean;
    created?: unknown[];
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

    const featureEnabled = await this.settings.getAiSetting<boolean>(
      workspaceId,
      'ai.test_case_suggest_enabled',
      true,
    );
    if (!featureEnabled) {
      throw new AiFeatureDisabledException('ai.test_case_suggest_enabled');
    }

    const task = await this.taskService.getById(taskId, undefined, workspaceId);

    const template = dto.templateId
      ? await this.templates.getById(workspaceId, dto.templateId)
      : await this.templates.getDefaultFor(workspaceId, 'suggest_test_cases');

    const locale = await resolveAiLocale(this.settings, userId, workspaceId);

    const { systemPrompt, userPrompt } = buildSuggestTestCasesPrompt(
      {
        taskTitle: task.title,
        taskDescription: task.description,
        maxSuggestions,
        locale,
      },
      template,
    );

    const response = await this.aiService.generateCompletion({
      workspaceId,
      userId,
      operation: AiOperation.SUGGEST_SUBTASKS,
      request: {
        systemPrompt,
        userPrompt,
        responseFormat: 'json',
        maxTokens: 4096,
      },
    });

    const testCases = parseTestCasesResponse(response.text, maxSuggestions);
    if (testCases.length === 0) {
      const snippet = response.text.slice(0, 500);
      const finishReason =
        (response as { finishReason?: string }).finishReason ?? 'unknown';
      this.logger.warn(
        `suggest-test-cases: failed to parse response from ${response.model} ` +
          `(finishReason=${finishReason}, length=${response.text.length}). ` +
          `Raw text (first 500 chars): ${snippet}`,
      );
      throw new AiResponseInvalidException(
        finishReason === 'MAX_TOKENS'
          ? 'AI response was cut off before any test case could be completed. Try fewer suggestions or shorter detail.'
          : 'AI response did not contain a parseable list of test cases. Check backend logs for the raw model output.',
      );
    }

    const apply = dto.apply === true;
    let created: unknown[] | undefined;
    if (apply) {
      created = await this.testCaseService.bulkCreate(
        workspaceId,
        taskId,
        testCases.map((t) => ({
          title: t.title,
          precondition: t.precondition ?? null,
          steps: t.steps ?? null,
          expected: t.expected ?? null,
        })),
      );
    }

    return {
      testCases,
      applied: apply,
      created,
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
