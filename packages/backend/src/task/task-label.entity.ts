import { Column, Entity, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { TaskEntity } from './task.entity';
import { LabelEntity } from '../project/label/label.entity';

@Entity('task_labels')
@Index(['taskId'])
@Unique(['taskId', 'labelId'])
export class TaskLabelEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  taskId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  labelId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @ManyToOne(() => LabelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'label_id' })
  label?: LabelEntity;
}
