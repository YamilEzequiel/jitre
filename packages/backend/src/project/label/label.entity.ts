import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../../common/entities/tenant.entity';
import { LabelScope } from '@jitre/shared';

@Entity('labels')
@Index(['workspaceId'])
export class LabelEntity extends TenantEntity {
  @ApiProperty()
  @Column({ type: 'varchar' })
  name!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @ApiProperty({ enum: LabelScope })
  @Column({ type: 'varchar', default: LabelScope.WORKSPACE })
  scope!: LabelScope;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @ManyToOne('ProjectEntity', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: unknown;
}
