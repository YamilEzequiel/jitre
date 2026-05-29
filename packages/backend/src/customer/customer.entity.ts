import { Column, Entity, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus } from '@jitre/shared';
import { TenantEntity } from '../common/entities/tenant.entity';

/**
 * Workspace-scoped Customer (a.k.a. client / account) used to attribute
 * projects to an external party. Name uniqueness is enforced via a partial
 * unique index over `LOWER(TRIM(name))` while `deleted_at IS NULL` — see
 * migration `1700000003100-AddCustomers.ts`.
 *
 * `icon` may either reference a PrimeIcons class (e.g. `pi-building`) or
 * hold a short emoji string — the frontend renders both shapes.
 */
@Entity('customers')
@Index(['workspaceId'])
export class CustomerEntity extends TenantEntity {
  @ApiProperty({ maxLength: 120 })
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @ApiProperty({ enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  @Column({ type: 'varchar', length: 20, default: CustomerStatus.ACTIVE })
  status!: CustomerStatus;

  @ApiProperty({ maxLength: 20, description: 'Hex color, e.g. #2563eb' })
  @Column({ type: 'varchar', length: 20 })
  color!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 40,
    description: 'PrimeIcons class (e.g. pi-building) or a short emoji.',
  })
  @Column({ type: 'varchar', length: 40, nullable: true })
  icon!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 180 })
  @Column({ type: 'varchar', length: 180, nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 40 })
  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 40,
    description: 'Tax identifier (CUIT / VAT / EIN). Stored verbatim.',
  })
  @Column({ name: 'tax_id', type: 'varchar', length: 40, nullable: true })
  taxId!: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @Column({ type: 'varchar', length: 250, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
