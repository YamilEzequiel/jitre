import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../../common/entities/tenant.entity';
import { StatusCategory } from '@jitre/shared';

@Entity('statuses')
@Index(['workspaceId', 'projectId'])
export class StatusEntity extends TenantEntity {
  @ApiProperty()
  @Column({ type: 'varchar' })
  name!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  order!: number;

  @ApiProperty({ enum: StatusCategory })
  @Column({ type: 'varchar' })
  category!: StatusCategory;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  /** Lazy relation — only used for cascade loading when needed. */
  @ManyToOne('ProjectEntity', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: unknown;
}
