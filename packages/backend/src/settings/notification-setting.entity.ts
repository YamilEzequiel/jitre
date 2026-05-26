import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Per-user notification preference, optionally scoped to a workspace.
 * - workspace_id = null  → user-global preference
 * - workspace_id = <UUID> → per-user-per-workspace preference (higher precedence)
 *
 * The COALESCE partial unique index prevents duplicates while allowing null workspace_id.
 */
@Entity('notification_settings')
@Index(
  'uq_ns_user_ws_key',
  // Raw SQL unique index — enforced at migration level due to COALESCE.
  // TypeORM @Index is declared here for documentation; actual constraint lives in the migration.
  ['userId', 'workspaceId', 'key'],
  { unique: false, where: '"deleted_at" IS NULL' },
)
export class NotificationSetting extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', name: 'workspace_id', nullable: true })
  workspaceId!: string | null;

  @ApiProperty()
  @Column({ type: 'text', name: 'key' })
  key!: string;

  @ApiProperty()
  @Column({ type: 'jsonb', name: 'value' })
  value!: unknown;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user?: unknown;

  @ManyToOne('WorkspaceEntity', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: unknown;
}
