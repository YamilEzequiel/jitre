import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { TaskPriority, TaskType } from '@jitre/shared';

@Entity('tasks')
@Index(['projectId'])
@Index(['statusId'])
@Index(['rank'])
@Index(['issueKey'], { unique: true })
@Index(['dueDate'])
@Index(['workspaceId'])
@Index(['type'])
export class TaskEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  projectId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  statusId!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'integer', nullable: true })
  issueNumber!: number | null;

  @ApiProperty({ nullable: true, example: 'PROJ-123' })
  @Column({ type: 'varchar', nullable: true })
  issueKey!: string | null;

  @ApiProperty()
  @Column({ type: 'varchar' })
  title!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: TaskPriority })
  @Column({ type: 'varchar', default: TaskPriority.NONE })
  priority!: TaskPriority;

  @ApiProperty({ enum: TaskType })
  @Column({ type: 'varchar', default: TaskType.TASK })
  type!: TaskType;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @Column({ type: 'date', nullable: true })
  dueDate!: Date | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @Column({ type: 'date', nullable: true })
  startDate!: Date | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'numeric', nullable: true })
  estimatedHours!: number | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  parentTaskId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  epicId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  sprintId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  releaseId!: string | null;

  @ApiProperty()
  @Column({ type: 'text', default: 'n' })
  rank!: string;

  @ApiProperty({ type: Object })
  @Column({ type: 'jsonb', default: {} })
  customFields!: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  /**
   * Self-referential ManyToOne for subtasks.
   * Max nesting of 2 enforced at service layer (ADR-7).
   */
  @ManyToOne(() => TaskEntity, (task) => task.subtasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_task_id' })
  parent?: TaskEntity | null;

  @OneToMany(() => TaskEntity, (task) => task.parent)
  subtasks?: TaskEntity[];

  /**
   * Multi-assignee relation (Fase 6). Loaded explicitly via `relations: ['assignments']`
   * â€” kept off the eager path so list queries stay cheap.
   */
  @OneToMany('TaskAssignmentEntity', (a: { task: TaskEntity }) => a.task)
  assignments?: Array<{ userId: string }>;

  @OneToMany('TaskLabelEntity', (label: { task: TaskEntity }) => label.task)
  labels?: Array<{ labelId: string }>;

  /** Flattened relation ids returned to board/list clients. */
  assigneeUserIds?: string[];
  labelIds?: string[];
}
