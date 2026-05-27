import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';

/**
 * Workspace-scoped Area (a.k.a. department / squad / team) used to group
 * users and projects under a shared organizational unit. Names are unique
 * per workspace among active (non-soft-deleted) rows — see the partial
 * unique index `uq_areas_workspace_name_active` in migration
 * `1700000002300-AddAreas.ts`.
 *
 * `icon` may either reference a PrimeIcons class (e.g. `pi-briefcase`) or
 * hold a short emoji string — the frontend renders both shapes.
 */
@Entity('areas')
@Index(['workspaceId'])
export class AreaEntity extends TenantEntity {
  @ApiProperty({ maxLength: 80 })
  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @ApiProperty({ maxLength: 20, description: 'Hex color, e.g. #7c3aed' })
  @Column({ type: 'varchar', length: 20 })
  color!: string;

  @ApiProperty({
    nullable: true,
    maxLength: 40,
    description: 'PrimeIcons class (e.g. pi-briefcase) or a short emoji.',
  })
  @Column({ type: 'varchar', length: 40, nullable: true })
  icon!: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
