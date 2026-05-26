import { Column, Entity, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../common/entities/base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ type: 'citext', unique: true })
  email!: string;

  @Exclude()
  @Column({ type: 'text' })
  passwordHash!: string;

  @Column({ type: 'text' })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @OneToMany('WorkspaceMembershipEntity', 'user')
  memberships!: unknown[];

  @OneToMany('SessionEntity', 'user')
  sessions!: unknown[];

  toJSON(): Record<string, unknown> {
    const { passwordHash: _, ...rest } = this as Record<string, unknown>;
    return rest;
  }
}
