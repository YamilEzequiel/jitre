import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601 } from 'class-validator';

export class AnalyticsPeriodDto {
  @ApiProperty({
    enum: ['day', 'week', 'month'],
    description: 'Aggregation period granularity',
  })
  @IsIn(['day', 'week', 'month'])
  period!: 'day' | 'week' | 'month';

  @ApiProperty({ description: 'Range start (inclusive), ISO 8601' })
  @IsISO8601()
  from!: string;

  @ApiProperty({ description: 'Range end (exclusive), ISO 8601' })
  @IsISO8601()
  to!: string;
}
