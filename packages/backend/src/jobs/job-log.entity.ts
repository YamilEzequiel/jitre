import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../common/entities/base.entity';

export type JobLogStatus = 'queued' | 'active' | 'completed' | 'failed';

/**
 * Durable audit row for every BullMQ job lifecycle event. Extends BaseEntity
 * (not TenantEntity) because jobs are system-scoped, not workspace-scoped.
 */
@Entity('job_logs')
@Index('idx_jl_queue_status_time', ['queueName', 'status', 'createdAt'], {
  where: '"deleted_at" IS NULL',
})
export class JobLog extends BaseEntity {
  @ApiProperty()
  @Column({ type: 'text', name: 'queue_name' })
  queueName!: string;

  @ApiProperty()
  @Column({ type: 'text', name: 'job_type' })
  jobType!: string;

  @ApiProperty()
  @Column({ type: 'text', name: 'job_id', unique: true })
  jobId!: string;

  @ApiProperty()
  @Column({ type: 'text', name: 'status' })
  status!: JobLogStatus;

  @ApiProperty()
  @Column({ type: 'int', name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  @Column({ type: 'jsonb', name: 'payload', default: {} })
  payload!: Record<string, unknown>;

  @ApiProperty({ nullable: true })
  @Column({ type: 'int', name: 'duration_ms', nullable: true })
  durationMs!: number | null;
}
