import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentContext } from '@jitre/shared';

export class ListCommentsDto {
  @ApiProperty({ enum: CommentContext })
  @IsEnum(CommentContext)
  contextType!: CommentContext;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contextId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}
