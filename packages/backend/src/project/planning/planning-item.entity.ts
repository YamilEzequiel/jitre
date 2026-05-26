import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../../common/entities/tenant.entity';

export type PlanningItemType = 'epic' | 'sprint' | 'release';

@Entity('planning_items')
@Index(['workspaceId', 'projectId', 'type'])
export class PlanningItemEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  projectId!: string;

  @ApiProperty({ enum: ['epic', 'sprint', 'release'] })
  @Column({ type: 'varchar' })
  type!: PlanningItemType;

  @ApiProperty()
  @Column({ type: 'varchar' })
  name!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  goal!: string | null;

  @ApiProperty()
  @Column({ type: 'varchar', default: 'planned' })
  status!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @Column({ type: 'date', nullable: true })
  startDate!: Date | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  @Column({ type: 'date', nullable: true })
  endDate!: Date | null;
}
