import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  Length,
  Matches,
  MinLength,
  IsDateString,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project name', minLength: 1 })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    description:
      'Project key: 3–8 uppercase alphanumeric chars. Immutable after create.',
    example: 'PROJ',
  })
  @IsString()
  @Length(3, 8)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'key must be uppercase alphanumeric (3–8 chars)',
  })
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  startDate?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  targetDate?: Date | null;
}
