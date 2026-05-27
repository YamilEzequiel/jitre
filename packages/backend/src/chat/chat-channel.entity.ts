import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';

export type ChatChannelType = 'public' | 'private' | 'dm';
export type ChatChannelKind = 'general' | 'project' | 'custom' | 'dm';

@Entity('chat_channels')
@Index(['workspaceId'])
@Index(['type'])
export class ChatChannelEntity extends TenantEntity {
  @ApiProperty()
  @Column({ type: 'varchar' })
  name!: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ['public', 'private', 'dm'] })
  @Column({ type: 'varchar' })
  type!: ChatChannelType;

  @ApiProperty({ enum: ['general', 'project', 'custom', 'dm'] })
  @Column({ type: 'varchar', default: 'custom' })
  kind!: ChatChannelKind;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @ApiProperty({ nullable: true, maxLength: 8 })
  @Column({ type: 'varchar', length: 8, nullable: true })
  icon!: string | null;
}
