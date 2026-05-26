import { Column, Entity } from 'typeorm';
import { NotificationType } from '@jitre/shared';
import { TenantEntity } from '../common/entities/tenant.entity';

@Entity('notifications')
export class Notification extends TenantEntity {
  @Column({ type: 'uuid', name: 'recipient_user_id' })
  recipientUserId!: string;

  @Column({ type: 'text', name: 'type' })
  type!: NotificationType;

  @Column({ type: 'text', name: 'title' })
  title!: string;

  @Column({ type: 'text', default: '', name: 'body' })
  body!: string;

  @Column({ type: 'jsonb', default: {}, name: 'data' })
  data!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt!: Date | null;

  @Column({ type: 'text', default: 'normal', name: 'priority' })
  priority!: 'low' | 'normal' | 'high';

  @Column({ type: 'timestamptz', default: () => 'now()', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'email_sent_at' })
  emailSentAt!: Date | null;
}
