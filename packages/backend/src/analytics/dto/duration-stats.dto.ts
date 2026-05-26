import { ApiProperty } from '@nestjs/swagger';

export class DurationStatsDto {
  @ApiProperty({ description: 'ISO period label' })
  period!: string;

  @ApiProperty({ description: 'Median duration in seconds (p50)' })
  p50!: number;

  @ApiProperty({ description: '75th percentile duration in seconds' })
  p75!: number;

  @ApiProperty({ description: '95th percentile duration in seconds' })
  p95!: number;

  @ApiProperty({ description: 'Mean duration in seconds' })
  mean!: number;

  @ApiProperty({ description: 'Sample count for this period' })
  count!: number;
}
