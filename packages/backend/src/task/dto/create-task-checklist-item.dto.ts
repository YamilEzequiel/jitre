import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTaskChecklistItemDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiProperty({ required: false, description: 'Optional explicit position; defaults to end.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
