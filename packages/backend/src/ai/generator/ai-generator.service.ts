import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  AiGeneratorDraft,
  AiGenerateCommitResponse,
  AiGenerateDraftResponse,
  AiOperation,
} from '@jitre/shared';
import { AiService } from '../ai.service';
import { AiResponseInvalidException } from '../exceptions/ai-response-invalid.exception';
import {
  buildGeneratorSystemPrompt,
  buildGeneratorUserPrompt,
  GeneratorParseError,
  parseGeneratorResponse,
} from '../prompts/generator.prompt';
import { StatusService } from '../../project/status/status.service';
import { DocumentService } from '../../document/document.service';
import { ProjectService } from '../../project/project.service';
import type { CreateTaskDto, TaskService } from '../../task/task.service';

export interface AiGeneratorDraftInput {
  workspaceId: string;
  userId: string;
  prompt: string;
  projectId?: string;
  projectName?: string | null;
}

export interface AiGeneratorCommitInput {
  workspaceId: string;
  userId: string;
  /** OWNER / ADMIN bypass project membership scoping when committing docs. */
  isWorkspaceAdmin?: boolean;
  draft: AiGeneratorDraft;
}

/**
 * Orchestrates the natural-language → structured-draft → commit pipeline.
 *
 * Stateless: `draft()` only reads context to compose the prompt; the LLM
 * output is parsed and returned as a typed draft. `commit()` is the only
 * step that writes to the DB, and it does so through the existing
 * domain services so all the usual events / validations / authorship
 * rules apply.
 */
@Injectable()
export class AiGeneratorService {
  private readonly logger = new Logger(AiGeneratorService.name);

  constructor(
    private readonly ai: AiService,
    private readonly statusService: StatusService,
    private readonly documentService: DocumentService,
    private readonly projectService: ProjectService,
    @Inject('TaskService')
    private readonly taskService: TaskService,
  ) {}

  async draft(input: AiGeneratorDraftInput): Promise<AiGenerateDraftResponse> {
    const systemPrompt = buildGeneratorSystemPrompt();
    const userPrompt = buildGeneratorUserPrompt({
      prompt: input.prompt,
      projectName: input.projectName ?? null,
    });

    const completion = await this.ai.generateCompletion({
      workspaceId: input.workspaceId,
      userId: input.userId,
      operation: AiOperation.GENERATE,
      request: {
        systemPrompt,
        userPrompt,
        responseFormat: 'json',
        temperature: 0.3,
      },
    });

    let parsed: AiGeneratorDraft;
    try {
      parsed = parseGeneratorResponse(completion.text);
    } catch (err) {
      if (err instanceof GeneratorParseError) {
        this.logger.warn(`AI generator parse error: ${err.message}`);
        throw new AiResponseInvalidException(err.message);
      }
      throw err;
    }

    // Honor the context projectId when the LLM didn't infer one.
    const draftWithContext = this.applyContextProject(parsed, input.projectId);

    return {
      drafts: [draftWithContext],
      model: completion.model,
      costUsd: completion.costUsd,
    };
  }

  async commit(input: AiGeneratorCommitInput): Promise<AiGenerateCommitResponse> {
    const { draft } = input;
    switch (draft.kind) {
      case 'task':
        return this.commitTask(input.workspaceId, input.userId, draft);
      case 'task_with_subtasks':
        return this.commitTaskWithSubtasks(input.workspaceId, input.userId, draft);
      case 'doc':
        return this.commitDoc(
          input.workspaceId,
          input.userId,
          input.isWorkspaceAdmin === true,
          draft,
        );
      case 'project':
        return this.commitProject(input.workspaceId, input.userId, draft);
      default: {
        const exhaustive: never = draft;
        throw new BadRequestException(`UNSUPPORTED_DRAFT_KIND: ${String(exhaustive)}`);
      }
    }
  }

  private async commitTask(
    workspaceId: string,
    userId: string,
    draft: Extract<AiGeneratorDraft, { kind: 'task' }>,
  ): Promise<AiGenerateCommitResponse> {
    const projectId = this.requireProject(draft.projectId);
    const statusId = await this.resolveInitialStatusId(projectId, workspaceId);

    const created = await this.taskService.create({
      workspaceId,
      projectId,
      statusId,
      title: draft.title,
      description: draft.description ?? null,
      ...(draft.priority ? { priority: draft.priority } : {}),
      actorUserId: userId,
    } satisfies CreateTaskDto);

    return { kind: 'task', id: created.id };
  }

  private async commitTaskWithSubtasks(
    workspaceId: string,
    userId: string,
    draft: Extract<AiGeneratorDraft, { kind: 'task_with_subtasks' }>,
  ): Promise<AiGenerateCommitResponse> {
    const projectId = this.requireProject(draft.projectId);
    const statusId = await this.resolveInitialStatusId(projectId, workspaceId);

    const parent = await this.taskService.create({
      workspaceId,
      projectId,
      statusId,
      title: draft.parent.title,
      description: draft.parent.description ?? null,
      ...(draft.parent.priority ? { priority: draft.parent.priority } : {}),
      actorUserId: userId,
    } satisfies CreateTaskDto);

    const childIds: string[] = [];
    for (const child of draft.subtasks) {
      const subtask = await this.taskService.create({
        workspaceId,
        projectId,
        statusId,
        title: child.title,
        description: child.description ?? null,
        ...(child.priority ? { priority: child.priority } : {}),
        parentTaskId: parent.id,
        actorUserId: userId,
      } satisfies CreateTaskDto);
      childIds.push(subtask.id);
    }

    return { kind: 'task_with_subtasks', id: parent.id, childIds };
  }

  private async commitDoc(
    workspaceId: string,
    userId: string,
    isWorkspaceAdmin: boolean,
    draft: Extract<AiGeneratorDraft, { kind: 'doc' }>,
  ): Promise<AiGenerateCommitResponse> {
    const document = await this.documentService.create({
      workspaceId,
      actorUserId: userId,
      isWorkspaceAdmin,
      title: draft.title,
      projectId: draft.projectId ?? null,
      icon: draft.icon ?? null,
      content: buildQuillDeltaFromText(draft.body ?? ''),
    });
    return { kind: 'doc', id: document.id };
  }

  private async commitProject(
    workspaceId: string,
    userId: string,
    draft: Extract<AiGeneratorDraft, { kind: 'project' }>,
  ): Promise<AiGenerateCommitResponse> {
    const project = await this.projectService.create({
      workspaceId,
      ownerUserId: userId,
      name: draft.name,
      key: draft.key,
      description: draft.description ?? null,
      icon: draft.icon ?? null,
      color: draft.color ?? null,
    });
    return { kind: 'project', id: project.id };
  }

  private applyContextProject(
    draft: AiGeneratorDraft,
    contextProjectId: string | undefined,
  ): AiGeneratorDraft {
    if (!contextProjectId) return draft;
    // `project` drafts aren't scoped to a project — they create one.
    if (draft.kind === 'project') return draft;
    if (draft.projectId) return draft;
    return { ...draft, projectId: contextProjectId };
  }

  private requireProject(projectId: string | null | undefined): string {
    if (!projectId) {
      throw new BadRequestException('PROJECT_REQUIRED_FOR_COMMIT');
    }
    return projectId;
  }

  private async resolveInitialStatusId(
    projectId: string,
    workspaceId: string,
  ): Promise<string> {
    const statuses = await this.statusService.listByProject(projectId, workspaceId);
    const first = statuses[0];
    if (!first) {
      throw new BadRequestException('PROJECT_HAS_NO_STATUSES');
    }
    return first.id;
  }
}

/**
 * Wraps plain-text body into the Quill Delta shape that DocumentService stores.
 * Paragraphs are split on blank lines; each gets a trailing newline so the
 * editor renders them as separate blocks.
 */
function buildQuillDeltaFromText(body: string): Record<string, unknown> {
  const trimmed = body.trim();
  if (!trimmed) return { ops: [] };
  const paragraphs = trimmed.split(/\n\s*\n/);
  const ops: { insert: string }[] = [];
  for (const paragraph of paragraphs) {
    ops.push({ insert: paragraph });
    ops.push({ insert: '\n\n' });
  }
  return { ops };
}
