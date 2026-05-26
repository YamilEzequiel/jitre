import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class BurndownQueryDto {
  @ApiProperty({ description: 'Range start (inclusive), ISO 8601' })
  @IsISO8601()
  from!: string;

  @ApiProperty({ description: 'Range end (exclusive), ISO 8601' })
  @IsISO8601()
  to!: string;

  @ApiPropertyOptional({
    description: 'Use end-of-day semantics (default true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  endOfDay?: boolean = true;
}
