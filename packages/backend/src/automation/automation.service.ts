import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  AutomationAction,
  AutomationCondition,
  AutomationEntity,
  AutomationRunEntity,
  AutomationTrigger,
} from './automation.entity';

export interface CreateAutomationInput {
  workspaceId: string;
  projectId: string;
  name: string;
  description?: string | null;
  trigger: AutomationTrigger;
  triggerConfig?: Record<string, unknown> | null;
  conditions?: AutomationCondition[] | null;
  actions: AutomationAction[];
  enabled?: boolean;
}

export interface UpdateAutomationInput {
  name?: string;
  description?: string | null;
  trigger?: AutomationTrigger;
  triggerConfig?: Record<string, unknown> | null;
  conditions?: AutomationCondition[] | null;
  actions?: AutomationAction[];
  enabled?: boolean;
}

const VALID_TRIGGERS: AutomationTrigger[] = [
  'task.created',
  'task.status_changed',
  'task.assigned',
  'task.priority_changed',
  'task.due_soon',
];

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(AutomationEntity)
    private readonly repo: Repository<AutomationEntity>,
    @InjectRepository(AutomationRunEntity)
    private readonly runRepo: Repository<AutomationRunEntity>,
  ) {}

  async list(projectId: string, workspaceId: string): Promise<AutomationEntity[]> {
    return this.repo.find({
      where: { projectId, workspaceId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<AutomationEntity | null> {
    return this.repo.findOne({ where: { id, workspaceId, deletedAt: IsNull() } });
  }

  async findActiveByTrigger(
    workspaceId: string,
    trigger: AutomationTrigger,
  ): Promise<AutomationEntity[]> {
    return this.repo.find({
      where: { workspaceId, trigger, enabled: true, deletedAt: IsNull() },
    });
  }

  async create(input: CreateAutomationInput): Promise<AutomationEntity> {
    if (!VALID_TRIGGERS.includes(input.trigger)) {
      throw new BadRequestException('TRIGGER_INVALID');
    }
    if (!input.actions || input.actions.length === 0) {
      throw new BadRequestException('AT_LEAST_ONE_ACTION_REQUIRED');
    }
    const entity = this.repo.create({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      name: input.name,
      description: input.description ?? null,
      trigger: input.trigger,
      triggerConfig: input.triggerConfig ?? null,
      conditions: input.conditions ?? null,
      actions: input.actions,
      enabled: input.enabled ?? true,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    workspaceId: string,
    patch: UpdateAutomationInput,
  ): Promise<AutomationEntity> {
    const found = await this.findById(id, workspaceId);
    if (!found) throw new NotFoundException('AUTOMATION_NOT_FOUND');
    Object.assign(found, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.trigger !== undefined ? { trigger: patch.trigger } : {}),
      ...(patch.triggerConfig !== undefined ? { triggerConfig: patch.triggerConfig } : {}),
      ...(patch.conditions !== undefined ? { conditions: patch.conditions } : {}),
      ...(patch.actions !== undefined ? { actions: patch.actions } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    return this.repo.save(found);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const found = await this.findById(id, workspaceId);
    if (!found) throw new NotFoundException('AUTOMATION_NOT_FOUND');
    await this.repo.softDelete(id);
  }

  /** Append-only run log. Never throws — logging only, best-effort. */
  async logRun(input: {
    automationId: string;
    workspaceId: string;
    status: 'success' | 'error' | 'skipped';
    context?: Record<string, unknown>;
    error?: string;
  }): Promise<void> {
    try {
      const run = this.runRepo.create({
        automationId: input.automationId,
        workspaceId: input.workspaceId,
        status: input.status,
        context: input.context ?? null,
        error: input.error ?? null,
      });
      await this.runRepo.save(run);
    } catch (err) {
      this.logger.error('Failed to log automation run', err);
    }
  }

  async listRuns(
    automationId: string,
    workspaceId: string,
    limit = 50,
  ): Promise<AutomationRunEntity[]> {
    return this.runRepo.find({
      where: { automationId, workspaceId },
      order: { triggeredAt: 'DESC' },
      take: limit,
    });
  }
}
