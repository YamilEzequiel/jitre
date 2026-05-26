import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, QueryFailedError, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { JobLog, JobLogStatus } from './job-log.entity';

export interface JobLogUpsertInput {
  queueName?: string;
  jobType?: string;
  status?: JobLogStatus;
  payload?: Record<string, unknown>;
  attemptCount?: number;
  errorMessage?: string | null;
  durationMs?: number | null;
}

export interface RecordEventArgs {
  jobId: string;
  name: string;
  attemptsMade: number;
  failedReason?: string;
  returnvalue?: unknown;
  timestamp?: number;
}

export interface JobLogPage {
  items: JobLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryByStatusOptions {
  queueName?: string;
  status?: JobLogStatus;
  page: number;
  pageSize: number;
}

/** Default sanitizer: strips keys matching /token|secret|password|signature|key/i */
const DEFAULT_SENSITIVE_PATTERN = /token|secret|password|signature|key/i;

function defaultSanitizer(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([k]) => !DEFAULT_SENSITIVE_PATTERN.test(k)),
  );
}

@Injectable()
export class JobLogService {
  /** In-memory map: jobId → start timestamp (ms). Used to compute durationMs. */

  readonly activeTimers = new Map<string, number>();

  /** Per-job-type sanitizer registry. Register via registerSanitizer(). */
  private readonly sanitizers = new Map<
    string,
    (payload: Record<string, unknown>) => Record<string, unknown>
  >();

  constructor(
    @InjectRepository(JobLog)
    private readonly repo: Repository<JobLog>,
  ) {}

  registerSanitizer(
    jobType: string,
    fn: (payload: Record<string, unknown>) => Record<string, unknown>,
  ): void {
    this.sanitizers.set(jobType, fn);
  }

  private sanitize(
    jobType: string | undefined,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitizer = jobType
      ? (this.sanitizers.get(jobType) ?? defaultSanitizer)
      : defaultSanitizer;
    return sanitizer(payload);
  }

  async upsert(jobId: string, input: JobLogUpsertInput): Promise<JobLog> {
    // The DB UNIQUE constraint on job_id is global (not partial on deleted_at),
    // so we must consider soft-deleted rows here too — otherwise revived jobs
    // collide with the constraint. We also retry once on a 23505 race that can
    // happen between two near-simultaneous BullMQ events for the same job.
    return this.upsertOnce(jobId, input).catch(async (err) => {
      const code = (err as { driverError?: { code?: string }; code?: string })
        ?.driverError?.code ?? (err as { code?: string })?.code;
      if (err instanceof QueryFailedError && code === '23505') {
        // Concurrent INSERT won the race; the row exists now — update it.
        return this.upsertOnce(jobId, input);
      }
      throw err;
    });
  }

  private async upsertOnce(
    jobId: string,
    input: JobLogUpsertInput,
  ): Promise<JobLog> {
    const existing = await this.repo.findOne({ where: { jobId } });

    const sanitizedPayload = input.payload
      ? this.sanitize(input.jobType, input.payload)
      : undefined;

    if (existing) {
      Object.assign(existing, {
        ...(input.queueName !== undefined && { queueName: input.queueName }),
        ...(input.jobType !== undefined && { jobType: input.jobType }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.attemptCount !== undefined && {
          attemptCount: input.attemptCount,
        }),
        ...(input.errorMessage !== undefined && {
          errorMessage: input.errorMessage,
        }),
        ...(input.durationMs !== undefined && { durationMs: input.durationMs }),
        ...(sanitizedPayload !== undefined && { payload: sanitizedPayload }),
      });
      // Revive any soft-deleted row so the constraint stays happy.
      existing.deletedAt = null;
      return this.repo.save(existing);
    }

    const entity = this.repo.create({
      jobId,
      queueName: input.queueName ?? '',
      jobType: input.jobType ?? '',
      status: input.status ?? 'queued',
      attemptCount: input.attemptCount ?? 0,
      errorMessage: input.errorMessage ?? null,
      payload: sanitizedPayload ?? {},
      durationMs: input.durationMs ?? null,
    });

    return this.repo.save(entity);
  }

  async recordEvent(
    queueName: string,
    eventType: 'waiting' | 'active' | 'completed' | 'failed',
    args: RecordEventArgs,
  ): Promise<void> {
    switch (eventType) {
      case 'waiting':
        await this.upsert(args.jobId, {
          queueName,
          jobType: args.name,
          status: 'queued',
          attemptCount: 0,
          payload: {},
        });
        break;

      case 'active':
        this.activeTimers.set(args.jobId, Date.now());
        await this.upsert(args.jobId, { status: 'active' });
        break;

      case 'completed': {
        const start = this.activeTimers.get(args.jobId);
        const durationMs = start !== undefined ? Date.now() - start : null;
        this.activeTimers.delete(args.jobId);
        await this.upsert(args.jobId, { status: 'completed', durationMs });
        break;
      }

      case 'failed':
        this.activeTimers.delete(args.jobId);
        await this.upsert(args.jobId, {
          status: 'failed',
          errorMessage: args.failedReason ?? null,
          attemptCount: args.attemptsMade,
        });
        break;
    }
  }

  async queryByStatus(options: QueryByStatusOptions): Promise<JobLogPage> {
    const where: Partial<JobLog> = {};
    if (options.queueName)
      (where as Record<string, unknown>).queueName = options.queueName;
    if (options.status)
      (where as Record<string, unknown>).status = options.status;

    const [items, total] = await this.repo.findAndCount({
      where: { ...where, deletedAt: IsNull() } as FindOptionsWhere<JobLog>,
      order: { createdAt: 'DESC' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    });

    return { items, total, page: options.page, pageSize: options.pageSize };
  }

  /** Prune rows older than retentionDays. Called by JobLogPruneScheduler. */
  async pruneOlderThan(retentionDays: number): Promise<void> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await this.repo.delete({ createdAt: LessThan(cutoff) });
  }
}
