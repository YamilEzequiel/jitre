import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { TaskEntity } from './task.entity';
import { TaskTestCaseStatus } from '@jitre/shared';

/**
 * Structured Test Case attached to a task. Unlike `TaskChecklistItemEntity`
 * (free-form acceptance criteria), a Test Case carries the canonical
 * precondition / steps / expected breakdown so QA can execute it without
 * re-reading the parent task description.
 *
 * Trazabilidad: when the case leaves `pending`, the service stamps
 * `completedByUserId` + `completedAt`. Resetting to `pending` clears both.
 */
@Entity('task_test_cases')
@Index(['taskId'])
@Index(['taskId', 'order'])
export class TaskTestCaseEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @ApiProperty()
  @Column({ type: 'varchar' })
  title!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  precondition!: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  steps!: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  expected!: string | null;

  @ApiProperty({ enum: TaskTestCaseStatus })
  @Column({ type: 'varchar', default: TaskTestCaseStatus.PENDING })
  status!: TaskTestCaseStatus;

  @ApiProperty()
  @Column({ type: 'integer', default: 0 })
  order!: number;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  completedByUserId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
