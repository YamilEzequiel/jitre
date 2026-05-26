import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AttachmentContext } from '@jitre/shared';

export class UploadAttachmentDto {
  @ApiProperty({ enum: AttachmentContext })
  @IsEnum(AttachmentContext)
  context!: AttachmentContext;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  contextId?: string;
}
