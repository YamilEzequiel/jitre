import { ApiProperty } from '@nestjs/swagger';

export class AiUsagePointDto {
  @ApiProperty({ description: 'ISO period label' })
  period!: string;

  @ApiProperty({ description: 'Number of AI requests in this period' })
  requests!: number;

  @ApiProperty({ description: 'Total cost as decimal string (precision 12,6)' })
  costUsd!: string;

  @ApiProperty({ description: 'Total tokens consumed' })
  totalTokens!: number;
}
