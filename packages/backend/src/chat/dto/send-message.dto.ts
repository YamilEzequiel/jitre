import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageAttachmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  size!: number;

  @ApiProperty({ maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  mimeType!: string;
}

export class SendMessageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  channelId!: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentMessageId?: string;

  @ApiPropertyOptional({ type: [SendMessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SendMessageAttachmentDto)
  attachments?: SendMessageAttachmentDto[];
}
