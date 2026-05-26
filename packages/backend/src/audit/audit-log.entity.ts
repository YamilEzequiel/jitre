import { Column, Entity, Index, Unique } from 'typeorm';
import { AuditAction } from '@jitre/shared';
import { TenantEntity } from '../common/entities/tenant.entity';

@Entity('audit_logs')
@Unique('uq_audit_event_id', ['eventId'])
export class AuditLog extends TenantEntity {
  @Column({ type: 'uuid', nullable: true, name: 'actor_user_id' })
  actorUserId!: string | null;

  @Column({ type: 'text', name: 'action' })
  action!: AuditAction;

  @Column({ type: 'text', name: 'subject_type' })
  subjectType!: string;

  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId!: string;

  @Column({ type: 'text', name: 'summary' })
  summary!: string;

  @Column({ type: 'jsonb', default: {}, name: 'diff' })
  diff!: Record<string, unknown>;

  @Index('idx_audit_ws_time')
  @Column({ type: 'timestamptz', default: () => 'now()', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'text', nullable: true, name: 'request_id' })
  requestId!: string | null;

  @Column({ type: 'uuid', unique: true, name: 'event_id' })
  eventId!: string;
}
