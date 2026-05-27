import { Column, Entity, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * AI-generated narrative summary of a workspace's prior-day activity.
 * One row per (workspace_id, digest_date) — the cron upserts daily.
 */
@Entity('ai_daily_digests')
@Unique('ux_ai_daily_digests_workspace_date', ['workspaceId', 'digestDate'])
@Index(['workspaceId', 'digestDate'])
export class AiDailyDigestEntity extends TenantEntity {
  /** Date the digest summarises (UTC date string YYYY-MM-DD). */
  @ApiProperty({ type: 'string', format: 'date' })
  @Column({ name: 'digest_date', type: 'date' })
  digestDate!: string;

  @ApiProperty()
  @Column({ type: 'text' })
  summary!: string;

  /** Counters captured at generation time so the UI can show stats. */
  @ApiProperty()
  @Column({ name: 'tasks_created', type: 'integer', default: 0 })
  tasksCreated!: number;

  @ApiProperty()
  @Column({ name: 'tasks_completed', type: 'integer', default: 0 })
  tasksCompleted!: number;

  @ApiProperty()
  @Column({ name: 'comments_posted', type: 'integer', default: 0 })
  commentsPosted!: number;

  @ApiProperty()
  @Column({ name: 'time_logged_minutes', type: 'integer', default: 0 })
  timeLoggedMinutes!: number;

  /** Model that produced the summary — handy for cost attribution. */
  @ApiProperty()
  @Column({ name: 'model', type: 'text' })
  model!: string;
}
