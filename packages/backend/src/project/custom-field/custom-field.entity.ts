import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../../common/entities/tenant.entity';
import { CustomFieldType, CustomFieldScope } from '@jitre/shared';

@Entity('custom_fields')
@Index(['workspaceId'])
export class CustomFieldEntity extends TenantEntity {
  @ApiProperty()
  @Column({ type: 'varchar' })
  name!: string;

  @ApiProperty({ enum: CustomFieldType })
  @Column({ type: 'varchar' })
  type!: CustomFieldType;

  @ApiProperty({ nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  options!: string[] | null;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  required!: boolean;

  @ApiProperty({ enum: CustomFieldScope })
  @Column({ type: 'varchar', default: CustomFieldScope.WORKSPACE })
  scope!: CustomFieldScope;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @ManyToOne('ProjectEntity', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: unknown;
}
