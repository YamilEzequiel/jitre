import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { TaskPriority } from '@jitre/shared';
import { AiPrioritySuggestionEntity } from './ai-priority-suggestion.entity';
import { TaskEntity } from '../../task/task.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';

interface SuggestionDraft {
  workspaceId: string;
  taskId: string;
  currentPriority: TaskPriority;
  suggestedPriority: TaskPriority;
  reason: string;
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  [TaskPriority.NONE]: 0,
  [TaskPriority.LOW]: 1,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.HIGH]: 3,
  [TaskPriority.URGENT]: 4,
};

@Injectable()
export class AiAutoPrioritizeService {
  private readonly logger = new Logger(AiAutoPrioritizeService.name);

  constructor(
    @InjectRepository(AiPrioritySuggestionEntity)
    private readonly suggRepo: Repository<AiPrioritySuggestionEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
  ) {}

  listOpen(workspaceId: string): Promise<AiPrioritySuggestionEntity[]> {
    return this.suggRepo.find({
      where: { workspaceId, status: 'open', deletedAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
  }

  async listForTask(
    workspaceId: string,
    taskId: string,
  ): Promise<AiPrioritySuggestionEntity[]> {
    return this.suggRepo.find({
      where: { workspaceId, taskId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async accept(workspaceId: string, id: string, userId: string): Promise<void> {
    const s = await this.suggRepo.findOne({ where: { id, workspaceId } });
    if (!s) throw new NotFoundException('suggestion_not_found');
    if (s.status !== 'open') return;

    await this.taskRepo.update(
      { id: s.taskId, workspaceId },
      { priority: s.suggestedPriority, updatedBy: userId },
    );
    s.status = 'accepted';
    s.updatedBy = userId;
    await this.suggRepo.save(s);
  }

  async dismiss(workspaceId: string, id: string, userId: string): Promise<void> {
    const s = await this.suggRepo.findOne({ where: { id, workspaceId } });
    if (!s) throw new NotFoundException('suggestion_not_found');
    if (s.status !== 'open') return;
    s.status = 'dismissed';
    s.updatedBy = userId;
    await this.suggRepo.save(s);
  }

  async generateAll(): Promise<{ created: number; stale: number }> {
    const workspaces = await this.workspaceRepo.find({ select: ['id'] });
    let created = 0;
    let stale = 0;
    for (const ws of workspaces) {
      const res = await this.generateFor(ws.id);
      created += res.created;
      stale += res.stale;
    }
    return { created, stale };
  }

  async generateFor(workspaceId: string): Promise<{ created: number; stale: number }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in3 = new Date(today);
    in3.setDate(in3.getDate() + 3);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);

    // Open tasks with a due date in the next 7 days. The query is intentionally
    // broad — the heuristic below decides which deserve a suggestion.
    const candidates = await this.taskRepo.find({
      where: {
        workspaceId,
        completedAt: IsNull() as unknown as Date,
        deletedAt: IsNull() as unknown as Date,
        dueDate: LessThanOrEqual(in7) as unknown as Date,
      },
      take: 500,
    });

    const drafts: SuggestionDraft[] = [];
    for (const t of candidates) {
      const draft = this.evaluate(t, today, in3);
      if (draft) drafts.push(draft);
    }

    // Mark existing open suggestions stale before creating fresh ones.
    const staleResult = await this.suggRepo.update(
      { workspaceId, status: 'open', deletedAt: IsNull() },
      { status: 'stale' },
    );

    let created = 0;
    for (const d of drafts) {
      // Skip if there's already an accepted suggestion with the same target
      // priority — no need to re-bug the user.
      const existingAccepted = await this.suggRepo.findOne({
        where: {
          workspaceId,
          taskId: d.taskId,
          suggestedPriority: d.suggestedPriority,
          status: 'accepted',
          deletedAt: IsNull(),
        },
      });
      if (existingAccepted) continue;

      await this.suggRepo.save(
        this.suggRepo.create({
          workspaceId: d.workspaceId,
          taskId: d.taskId,
          currentPriority: d.currentPriority,
          suggestedPriority: d.suggestedPriority,
          reason: d.reason,
          status: 'open',
        }),
      );
      created++;
    }

    return { created, stale: staleResult.affected ?? 0 };
  }

  /**
   * Heuristic-only (no LLM call): cheap, deterministic, never makes things up.
   * - Due in <= 3 days AND priority < HIGH → suggest HIGH.
   * - Due in <= 7 days AND priority NONE/LOW → suggest MEDIUM.
   * - Overdue AND priority < URGENT → suggest URGENT.
   */
  private evaluate(task: TaskEntity, today: Date, in3: Date): SuggestionDraft | null {
    if (!task.dueDate) return null;
    const due = new Date(task.dueDate);
    const isOverdue = due.getTime() < today.getTime();
    const isWithin3 = due.getTime() <= in3.getTime();
    const rank = PRIORITY_RANK[task.priority];

    if (isOverdue && rank < PRIORITY_RANK[TaskPriority.URGENT]) {
      return {
        workspaceId: task.workspaceId,
        taskId: task.id,
        currentPriority: task.priority,
        suggestedPriority: TaskPriority.URGENT,
        reason: `Overdue (due ${this.formatDate(due)}, currently ${task.priority || 'none'}).`,
      };
    }
    if (isWithin3 && rank < PRIORITY_RANK[TaskPriority.HIGH]) {
      return {
        workspaceId: task.workspaceId,
        taskId: task.id,
        currentPriority: task.priority,
        suggestedPriority: TaskPriority.HIGH,
        reason: `Due in ≤ 3 days (${this.formatDate(due)}, currently ${task.priority || 'none'}).`,
      };
    }
    if (rank < PRIORITY_RANK[TaskPriority.MEDIUM]) {
      return {
        workspaceId: task.workspaceId,
        taskId: task.id,
        currentPriority: task.priority,
        suggestedPriority: TaskPriority.MEDIUM,
        reason: `Due within a week (${this.formatDate(due)}, currently ${task.priority || 'none'}).`,
      };
    }
    return null;
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
