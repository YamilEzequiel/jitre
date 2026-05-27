import { Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from './base.entity';

/**
 * Tenant-scoped entity. Any data belonging to a workspace MUST extend this
 * instead of `BaseEntity` directly. The `TenancyGuard` (Fase 2) uses
 * `workspaceId` to filter queries automatically and to populate the column
 * on insert from the authenticated request context.
 */
export abstract class TenantEntity extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Index()
  @Column({ type: 'uuid' })
  workspaceId!: string;
}
