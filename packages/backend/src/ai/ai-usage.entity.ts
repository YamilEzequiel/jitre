import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { AiProvider, AiOperation } from '@jitre/shared';

/**
 * Permanent audit record for every AI call made within a workspace.
 * Extends TenantEntity (workspaceId included); soft-delete column inherited
 * but never set by AiUsageService (AI usage is permanent audit).
 */
@Entity('ai_usage_records')
@Index('idx_ai_usage_ws_time', ['workspaceId', 'createdAt'])
@Index('idx_ai_usage_ws_user_time', ['workspaceId', 'userId', 'createdAt'])
@Index('idx_ai_usage_ws_op_time', ['workspaceId', 'operation', 'createdAt'])
export class AiUsageRecord extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: AiProvider })
  @Column({ type: 'text' })
  provider!: string;

  @ApiProperty()
  @Column({ type: 'text' })
  model!: string;

  @ApiProperty({ enum: AiOperation })
  @Column({ type: 'text' })
  operation!: string;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  promptTokens!: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  completionTokens!: number;

  /** Stored (not generated) per ADR-7. AiService always sets all three values. */
  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  totalTokens!: number;

  /** Stored as string to avoid float drift on decimal(12,6). */
  @ApiProperty()
  @Column({ type: 'decimal', precision: 12, scale: 6, default: '0.000000' })
  costUsd!: string;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  latencyMs!: number;

  @ApiProperty()
  @Column({ type: 'boolean', default: true })
  success!: boolean;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  errorCode!: string | null;
}
