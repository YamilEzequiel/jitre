import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';

export interface ChatMessageAttachment {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

@Entity('chat_messages')
@Index(['channelId', 'createdAt'])
@Index(['authorId'])
@Index(['parentMessageId'])
export class ChatMessageEntity extends TenantEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  channelId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  authorId!: string;

  @ApiProperty()
  @Column({ type: 'text' })
  body!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  parentMessageId!: string | null;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachments!: ChatMessageAttachment[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  editedAt!: Date | null;
}
