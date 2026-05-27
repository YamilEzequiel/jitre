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

  // ── Employee profile fields (all nullable, see migration 1700000001700)
  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  position!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department!: string | null;

  @Column({ type: 'date', name: 'hire_date', nullable: true })
  hireDate!: string | null;

  @Column({ type: 'date', name: 'birth_date', nullable: true })
  birthDate!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', length: 40, name: 'employee_code', nullable: true })
  employeeCode!: string | null;

  @Column({ type: 'varchar', length: 200, name: 'emergency_contact', nullable: true })
  emergencyContact!: string | null;

  @OneToMany('WorkspaceMembershipEntity', 'user')
  memberships!: unknown[];

  @OneToMany('SessionEntity', 'user')
  sessions!: unknown[];

  toJSON(): Record<string, unknown> {
    const { passwordHash: _, ...rest } = this as Record<string, unknown>;
    return rest;
  }
}
