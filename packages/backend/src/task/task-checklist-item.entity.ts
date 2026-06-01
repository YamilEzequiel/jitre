import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { TaskEntity } from './task.entity';
import { TaskChecklistItemStatus } from '@jitre/shared';

/**
 * A single checklist item attached to a task. Used to express acceptance
 * criteria / QA cases as first-class data instead of free-form markdown in
 * `task.description`.
 *
 * Trazabilidad: when a QA marks the item as `passed`, `failed` or `blocked`,
 * the service stamps `completedByUserId` and `completedAt`. Resetting back to
 * `pending` clears both fields.
 */
@Entity('task_checklist_items')
@Index(['taskId'])
@Index(['taskId', 'order'])
export class TaskChecklistItemEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @ApiProperty()
  @Column({ type: 'text' })
  content!: string;

  @ApiProperty({ enum: TaskChecklistItemStatus })
  @Column({ type: 'varchar', default: TaskChecklistItemStatus.PENDING })
  status!: TaskChecklistItemStatus;

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
