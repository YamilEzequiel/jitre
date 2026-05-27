import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';
import { ProjectEntity } from '../project.entity';
import { StatusEntity } from '../status/status.entity';

@Entity('workflow_transitions')
export class WorkflowTransitionEntity extends TenantEntity {
  @Column({ type: 'uuid', name: 'project_id' })
  projectId!: string;

  @ManyToOne(() => ProjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: ProjectEntity;

  @Column({ type: 'uuid', name: 'from_status_id' })
  fromStatusId!: string;

  @ManyToOne(() => StatusEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_status_id' })
  fromStatus?: StatusEntity;

  @Column({ type: 'uuid', name: 'to_status_id' })
  toStatusId!: string;

  @ManyToOne(() => StatusEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_status_id' })
  toStatus?: StatusEntity;

  @Column({ type: 'boolean', name: 'requires_assignee', default: false })
  requiresAssignee!: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label!: string | null;
}
