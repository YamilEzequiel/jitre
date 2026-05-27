import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Represents a direct "reports-to" relationship between two users inside a
 * workspace. Edge semantics: `userId` reports to `reportsToUserId`.
 *
 * This is NOT a `TenantEntity` because it doesn't need the full audit /
 * version contract of BaseEntity — it's an immutable, append-only graph edge
 * that we soft-delete to break the link. Only `workspaceId`, `createdAt`,
 * `createdByUserId` and `deletedAt` are tracked.
 *
 * Uniqueness on `(workspaceId, userId, reportsToUserId)` is enforced at the
 * DB level via a PARTIAL unique index (`WHERE deleted_at IS NULL`), so a
 * relationship can be re-created after removal without conflicting with the
 * tombstone row.
 */
@Entity('user_reports_to')
@Index('idx_user_reports_to_workspace_user', ['workspaceId', 'userId'])
@Index('idx_user_reports_to_workspace_supervisor', [
  'workspaceId',
  'reportsToUserId',
])
export class UserReportsToEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  workspaceId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  reportsToUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
