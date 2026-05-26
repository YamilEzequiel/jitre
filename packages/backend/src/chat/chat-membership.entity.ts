import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type ChatNotificationLevel = 'all' | 'mentions' | 'none';

/**
 * Join entity between ChatChannel and User.
 * Composite primary key (channelId, userId). NOT a TenantEntity — workspaceId
 * is reachable through the channel, and the row only exists when the channel does.
 */
@Entity('chat_memberships')
@Index(['userId'])
@Index(['channelId'])
export class ChatMembershipEntity {
  @ApiProperty({ format: 'uuid' })
  @PrimaryColumn({ type: 'uuid' })
  channelId!: string;

  @ApiProperty({ format: 'uuid' })
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  lastReadMessageId!: string | null;

  @ApiProperty({ enum: ['all', 'mentions', 'none'] })
  @Column({ type: 'varchar', default: 'all' })
  notificationLevel!: ChatNotificationLevel;
}
