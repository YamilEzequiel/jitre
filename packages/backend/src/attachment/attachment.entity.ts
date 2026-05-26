import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../common/entities/tenant.entity';
import { AttachmentContext } from '@jitre/shared';

@Entity('attachments')
@Index(['workspaceId', 'context', 'contextId'])
@Index(['workspaceId', 'uploadedByUserId', 'createdAt'])
export class Attachment extends TenantEntity {
  @ApiProperty({ enum: AttachmentContext })
  @Column({ type: 'text' })
  context!: AttachmentContext;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ type: 'uuid', nullable: true })
  contextId!: string | null;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  uploadedByUserId!: string;

  @ApiProperty()
  @Column({ type: 'text', unique: false })
  storageKey!: string;

  @ApiProperty()
  @Column({ type: 'text' })
  originalFilename!: string;

  @ApiProperty()
  @Column({ type: 'text' })
  mimeType!: string;

  @ApiProperty()
  @Column({ type: 'bigint' })
  sizeBytes!: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  checksum!: string | null;
}
