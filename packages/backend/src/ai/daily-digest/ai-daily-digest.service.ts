import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiOperation } from '@jitre/shared';
import { AiDailyDigestEntity } from './ai-daily-digest.entity';
import { AiService } from '../ai.service';
import { TaskEntity } from '../../task/task.entity';
import { Comment } from '../../comment/comment.entity';
import { TimeEntryEntity } from '../../time-tracking/time-entry.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';
import { WorkspaceMembershipEntity } from '../../workspace/workspace-membership.entity';
import { SYSTEM_USER_ID } from '../../common/constants/system-user.constant';

interface ActivitySnapshot {
  workspaceId: string;
  tasksCreated: number;
  tasksCompleted: number;
  commentsPosted: number;
  timeLoggedMinutes: number;
  topAssignees: { userId: string; tasks: number }[];
}

/**
 * Builds the prior-day activity snapshot for a workspace and feeds it
 * to the AI provider to produce a narrative digest. Idempotent: an
 * existing digest for the same (workspace, date) is replaced.
 */
@Injectable()
export class AiDailyDigestService {
  private readonly logger = new Logger(AiDailyDigestService.name);

  constructor(
    @InjectRepository(AiDailyDigestEntity)
    private readonly digestRepo: Repository<AiDailyDigestEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(TimeEntryEntity)
    private readonly timeRepo: Repository<TimeEntryEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMembershipEntity)
    private readonly membershipRepo: Repository<WorkspaceMembershipEntity>,
    private readonly aiService: AiService,
  ) {}

  async getForToday(workspaceId: string): Promise<AiDailyDigestEntity | null> {
    return this.digestRepo.findOne({
      where: { workspaceId, digestDate: this.todayUtc() },
    });
  }

  async getByDate(workspaceId: string, date: string): Promise<AiDailyDigestEntity | null> {
    return this.digestRepo.findOne({ where: { workspaceId, digestDate: date } });
  }

  async listRecent(workspaceId: string, limit = 7): Promise<AiDailyDigestEntity[]> {
    return this.digestRepo.find({
      where: { workspaceId },
      order: { digestDate: 'DESC' },
      take: limit,
    });
  }

  /** Generate (or regenerate) the digest for one workspace. */
  async generateFor(workspaceId: string, targetDateUtc?: string): Promise<AiDailyDigestEntity> {
    const digestDate = targetDateUtc ?? this.yesterdayUtc();
    const { dayStart, dayEnd } = this.dayRange(digestDate);

    const snapshot = await this.collectActivity(workspaceId, dayStart, dayEnd);

    // Skip empty days — no point asking the LLM to summarise nothing.
    const isEmpty =
      snapshot.tasksCreated === 0 &&
      snapshot.tasksCompleted === 0 &&
      snapshot.commentsPosted === 0 &&
      snapshot.timeLoggedMinutes === 0;
    if (isEmpty) {
      return this.upsertDigest({
        workspaceId,
        digestDate,
        summary: '_(No activity to summarise on this day.)_',
        tasksCreated: 0,
        tasksCompleted: 0,
        commentsPosted: 0,
        timeLoggedMinutes: 0,
        model: 'none',
      });
    }

    const systemPrompt = `You are an upbeat but precise team-update writer. Produce a markdown digest of yesterday's workspace activity. Use exactly these headings (omit any that have zero data): ### Highlights, ### Shipped, ### Conversation, ### Time. Keep it under 250 words. Mention concrete numbers from the data; never invent metrics.`;
    const userPrompt = `Date: ${digestDate}
Tasks created: ${snapshot.tasksCreated}
Tasks completed: ${snapshot.tasksCompleted}
Comments posted: ${snapshot.commentsPosted}
Time logged (hours): ${(snapshot.timeLoggedMinutes / 60).toFixed(1)}
Top contributors (by tasks touched): ${snapshot.topAssignees
      .map((a) => `${a.userId.slice(0, 8)}=${a.tasks}`)
      .join(', ') || 'n/a'}

Write the markdown digest.`;

    try {
      const completion = await this.aiService.generateCompletion({
        workspaceId,
        // Attribute the AI usage row to the platform system user so
        // analytics can cleanly filter human vs scheduler-driven calls.
        userId: SYSTEM_USER_ID,
        operation: AiOperation.SUMMARY,
        request: { systemPrompt, userPrompt, maxTokens: 600 },
      });

      return this.upsertDigest({
        workspaceId,
        digestDate,
        summary: completion.text,
        tasksCreated: snapshot.tasksCreated,
        tasksCompleted: snapshot.tasksCompleted,
        commentsPosted: snapshot.commentsPosted,
        timeLoggedMinutes: snapshot.timeLoggedMinutes,
        model: completion.model,
      });
    } catch (err) {
      this.logger.warn(
        `Daily digest failed for workspace ${workspaceId} on ${digestDate}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /** Iterate every workspace and generate yesterday's digest. */
  async generateAll(): Promise<{ generated: number; failed: number }> {
    const workspaces = await this.workspaceRepo.find({ select: ['id'] });
    let generated = 0;
    let failed = 0;
    for (const ws of workspaces) {
      try {
        await this.generateFor(ws.id);
        generated++;
      } catch {
        failed++;
      }
    }
    return { generated, failed };
  }

  private async collectActivity(
    workspaceId: string,
    start: Date,
    end: Date,
  ): Promise<ActivitySnapshot> {
    const [createdTasksRows, completedTasksRows, commentsCountRow, timeRow, topAssigneeRows] =
      await Promise.all([
        this.taskRepo
          .createQueryBuilder('t')
          .where('t.workspace_id = :w', { w: workspaceId })
          .andWhere('t.created_at >= :s AND t.created_at < :e', { s: start, e: end })
          .getCount(),
        this.taskRepo
          .createQueryBuilder('t')
          .where('t.workspace_id = :w', { w: workspaceId })
          .andWhere('t.completed_at IS NOT NULL')
          .andWhere('t.completed_at >= :s AND t.completed_at < :e', { s: start, e: end })
          .getCount(),
        this.commentRepo
          .createQueryBuilder('c')
          .where('c.workspace_id = :w', { w: workspaceId })
          .andWhere('c.created_at >= :s AND c.created_at < :e', { s: start, e: end })
          .getCount(),
        this.timeRepo
          .createQueryBuilder('te')
          .select('COALESCE(SUM(te.duration_minutes), 0)', 'minutes')
          .where('te.workspace_id = :w', { w: workspaceId })
          .andWhere('te.created_at >= :s AND te.created_at < :e', { s: start, e: end })
          .getRawOne<{ minutes: string }>(),
        this.taskRepo
          .createQueryBuilder('t')
          .leftJoin('task_assignments', 'ta', 'ta.task_id = t.id')
          .select('ta.user_id', 'userId')
          .addSelect('COUNT(t.id)', 'tasks')
          .where('t.workspace_id = :w', { w: workspaceId })
          .andWhere('t.updated_at >= :s AND t.updated_at < :e', { s: start, e: end })
          .andWhere('ta.user_id IS NOT NULL')
          .groupBy('ta.user_id')
          .orderBy('COUNT(t.id)', 'DESC')
          .limit(3)
          .getRawMany<{ userId: string; tasks: string }>(),
      ]);

    return {
      workspaceId,
      tasksCreated: createdTasksRows,
      tasksCompleted: completedTasksRows,
      commentsPosted: commentsCountRow,
      timeLoggedMinutes: Number(timeRow?.minutes ?? 0),
      topAssignees: topAssigneeRows.map((r) => ({
        userId: r.userId,
        tasks: Number(r.tasks),
      })),
    };
  }

  private async upsertDigest(
    data: Omit<AiDailyDigestEntity, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdBy' | 'updatedBy' | 'version'>,
  ): Promise<AiDailyDigestEntity> {
    const existing = await this.digestRepo.findOne({
      where: { workspaceId: data.workspaceId, digestDate: data.digestDate },
    });
    if (existing) {
      const merged = this.digestRepo.merge(existing, data);
      return this.digestRepo.save(merged);
    }
    return this.digestRepo.save(this.digestRepo.create(data));
  }

  private todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private yesterdayUtc(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private dayRange(dateUtc: string): { dayStart: Date; dayEnd: Date } {
    const dayStart = new Date(`${dateUtc}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    return { dayStart, dayEnd };
  }
}
