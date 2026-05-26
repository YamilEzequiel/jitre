import { Column, Entity, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';

/**
 * DocumentEntity — Docs/Wiki page (Notion-like).
 *
 * - Workspace-scoped via {@link TenantEntity}.
 * - Optionally project-scoped via {@link projectId}.
 * - Hierarchical via self-referential {@link parentId} (ON DELETE CASCADE).
 * - Rich content stored as Quill Delta JSON in {@link content}. A flattened
 *   plain-text representation is mirrored to {@link contentText} on write
 *   for search and preview (kept in sync by the service layer).
 *
 * NOTE on authorship: {@link BaseEntity} already exposes `createdBy`/`updatedBy`
 * which the AuditSubscriber fills from the active CLS context. We keep distinct
 * domain-level fields {@link creatorUserId} and {@link lastEditedByUserId} so the
 * Docs domain owns its own "page author" / "last editor" semantics independently
 * of the audit columns.
 */
@Entity('documents')
@Index(['workspaceId'])
@Index(['projectId'])
@Index(['parentId'])
@Index(['order'])
export class DocumentEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @ApiProperty()
  @Column({ type: 'varchar' })
  title!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @ApiProperty({ type: Object })
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  content!: Record<string, unknown>;

  @ApiProperty()
  @Column({ type: 'text', default: '' })
  contentText!: string;

  @ApiProperty()
  @Column({ type: 'integer', default: 0 })
  order!: number;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  creatorUserId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  lastEditedByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastEditedAt!: Date | null;

  @ManyToOne(() => DocumentEntity, (d) => d.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: DocumentEntity | null;

  @OneToMany(() => DocumentEntity, (d) => d.parent)
  children?: DocumentEntity[];
}
