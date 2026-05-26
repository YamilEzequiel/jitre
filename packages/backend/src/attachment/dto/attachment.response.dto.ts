import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  context!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  contextId?: string | null;

  @ApiProperty()
  originalFilename!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiPropertyOptional()
  checksum?: string | null;

  @ApiProperty()
  createdAt!: Date;
}
