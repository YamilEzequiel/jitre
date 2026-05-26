import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../common/entities/base.entity';
import { UserEntity } from '../user/user.entity';

@Entity('sessions')
export class SessionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Exclude()
  @Column({ type: 'text' })
  refreshTokenHash!: string;

  @Column({ type: 'jsonb', default: '{}' })
  deviceInfo!: { userAgent: string; ip: string };

  @Column({ type: 'timestamptz' })
  lastUsedAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  toJSON(): Record<string, unknown> {
    const { refreshTokenHash: _, ...rest } = this as Record<string, unknown>;
    return rest;
  }
}
