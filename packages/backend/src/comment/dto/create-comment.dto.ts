import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentContext } from '@jitre/shared';

export class CreateCommentDto {
  @ApiProperty({ enum: CommentContext })
  @IsEnum(CommentContext)
  contextType!: CommentContext;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contextId!: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
