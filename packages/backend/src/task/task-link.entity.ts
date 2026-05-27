import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { TenantEntity } from '../common/entities/tenant.entity';
import { TaskEntity } from './task.entity';

export type TaskLinkType = 'blocks' | 'relates_to' | 'duplicates' | 'clones';

export const TASK_LINK_TYPES: readonly TaskLinkType[] = [
  'blocks',
  'relates_to',
  'duplicates',
  'clones',
] as const;

@Entity('task_links')
export class TaskLinkEntity extends TenantEntity {
  @Column({ type: 'uuid', name: 'source_task_id' })
  sourceTaskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_task_id' })
  sourceTask?: TaskEntity;

  @Column({ type: 'uuid', name: 'target_task_id' })
  targetTaskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_task_id' })
  targetTask?: TaskEntity;

  @Column({ type: 'varchar', length: 40, name: 'link_type' })
  linkType!: TaskLinkType;

  // `createdBy` (the actor's UUID) is inherited from BaseEntity and is
  // populated automatically by AuditSubscriber from RequestContext.
}
