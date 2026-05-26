import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Per-workspace setting (e.g. default_locale, invite_only). Managed by ADMIN+.
 * Unique partial index: (workspace_id, key) WHERE deleted_at IS NULL.
 */
@Entity('workspace_settings')
@Index('uq_ws_ws_key', ['workspaceId', 'key'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class WorkspaceSetting extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @ApiProperty()
  @Column({ type: 'text', name: 'key' })
  key!: string;

  @ApiProperty()
  @Column({ type: 'jsonb', name: 'value' })
  value!: unknown;

  @ManyToOne('WorkspaceEntity', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: unknown;
}
