import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';

/**
 * TimeEntryEntity — single block of tracked work time (Tempo-style).
 *
 * - Workspace-scoped via {@link TenantEntity}.
 * - Belongs to a task (and indirectly to a project + assignee user).
 * - Duration is stored in **integer minutes** to avoid floating-point drift
 *   when aggregating reports.
 * - {@link date} represents the **calendar day** the work happened (not the
 *   creation timestamp) so reports group correctly.
 * - {@link startedAt} / {@link stoppedAt} are optional and only populated by
 *   the timer flow. Manual log entries leave them `null`.
 */
@Entity('time_entries')
@Index(['workspaceId'])
@Index(['taskId'])
@Index(['userId'])
@Index(['date'])
@Index(['userId', 'date'])
export class TimeEntryEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  taskId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty({ type: Number, description: 'Duration in minutes (0..1440)' })
  @Column({ type: 'integer' })
  durationMinutes!: number;

  @ApiProperty({ type: String, format: 'date' })
  @Column({ type: 'date' })
  date!: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ApiProperty({ type: Boolean })
  @Column({ type: 'boolean', default: true })
  billable!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  stoppedAt!: Date | null;
}
