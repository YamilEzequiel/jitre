import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Per-user, workspace-agnostic setting (e.g. timezone, locale, theme).
 * Unique partial index: (user_id, key) WHERE deleted_at IS NULL.
 */
@Entity('user_settings')
@Index('uq_us_user_key', ['userId', 'key'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class UserSetting extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ApiProperty()
  @Column({ type: 'text', name: 'key' })
  key!: string;

  @ApiProperty()
  @Column({ type: 'jsonb', name: 'value' })
  value!: unknown;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user?: unknown;
}
