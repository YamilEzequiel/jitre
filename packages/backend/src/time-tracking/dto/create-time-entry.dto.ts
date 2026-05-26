import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTimeEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  taskId!: string;

  @ApiProperty({ minimum: 0, maximum: 1440 })
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMinutes!: number;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
