import { Column, Entity, Index, OneToMany, Unique } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 40, nullable: true })
  category!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 60, nullable: true })
  framework!: string | null;

  /**
   * Database technology used by the project (e.g. "PostgreSQL").
   * Column name is quoted in DDL because `database` is a reserved word in
   * some SQL dialects. PostgreSQL accepts it unquoted, but TypeORM will
   * generate identifiers correctly either way.
   */
  @ApiPropertyOptional({ nullable: true })
  @Column({ name: 'database', type: 'varchar', length: 60, nullable: true })
  database!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ name: 'customer_name', type: 'varchar', length: 120, nullable: true })
  customerName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ name: 'repository_url', type: 'varchar', length: 500, nullable: true })
  repositoryUrl!: string | null;

  /**
   * Optional reference to an {@link AreaEntity}. FK is set up via migration
   * `1700000002300-AddAreas.ts` with `ON DELETE SET NULL`.
   */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', name: 'area_id', nullable: true })
  areaId!: string | null;

  @OneToMany('StatusEntity', 'project')
  statuses?: unknown[];

  @OneToMany('LabelEntity', 'project')
  labels?: unknown[];

  @OneToMany('CustomFieldEntity', 'project')
  customFields?: unknown[];
}
