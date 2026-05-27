import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUrl,
  Length,
  Matches,
  MaxLength,
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

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string | null;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  framework?: string | null;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  database?: string | null;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string | null;

  @ApiPropertyOptional({ maxLength: 500, format: 'uri' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_tld: false, require_protocol: true })
  repositoryUrl?: string | null;
}
