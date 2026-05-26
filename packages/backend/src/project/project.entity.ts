import { Column, Entity, Index, OneToMany, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { ProjectStatus } from '@jitre/shared';

@Entity('projects')
@Index(['workspaceId'])
@Unique(['workspaceId', 'key'])
export class ProjectEntity extends TenantEntity {
  @ApiProperty()
  @Column({ type: 'varchar' })
  name!: string;

  /**
   * Project key: 3–8 uppercase alphanumeric chars. Immutable after create.
   * @see UpdateProjectDto (excludes key field)
   */
  @ApiProperty()
  @Column({ type: 'varchar', length: 8 })
  key!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ProjectStatus })
  @Column({ type: 'varchar', default: ProjectStatus.ACTIVE })
  status!: ProjectStatus;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @Column({ type: 'date', nullable: true })
  startDate!: Date | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @Column({ type: 'date', nullable: true })
  targetDate!: Date | null;

  @OneToMany('StatusEntity', 'project')
  statuses?: unknown[];

  @OneToMany('LabelEntity', 'project')
  labels?: unknown[];

  @OneToMany('CustomFieldEntity', 'project')
  customFields?: unknown[];
}
