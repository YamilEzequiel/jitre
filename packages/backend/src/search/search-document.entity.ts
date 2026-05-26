import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';

export type SearchEntityType =
  | 'comment'
  | 'workspace'
  | 'user'
  | 'task'
  | 'project'
  | 'document';

/**
 * Stores a pre-built tsvector index document for fast full-text search.
 * Extends TenantEntity — documents are scoped to a workspace.
 * The GIN index on tsvector makes tsquery lookups fast at PG level.
 */
@Entity('search_documents')
@Index('uq_sd_ws_type_entity', ['workspaceId', 'entityType', 'entityId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class SearchDocument extends TenantEntity {
  @ApiProperty()
  @Column({ type: 'text', name: 'entity_type' })
  entityType!: SearchEntityType;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @ApiProperty()
  @Column({ type: 'text', name: 'content' })
  content!: string;

  /**
   * Stored tsvector — updated via raw SQL to_tsvector('simple', content).
   * TypeORM does not have a native tsvector type; use 'simple' as column type
   * and let PG interpret it correctly.
   */
  @Column({ type: 'simple-array', name: 'tsvector', select: false })
  tsvector!: any;

  @ApiProperty()
  @Column({ type: 'real', name: 'boost', default: 1.0 })
  boost!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Column({ type: 'timestamptz', name: 'occurred_at', default: () => 'now()' })
  occurredAt!: Date;
}
