import { ApiProperty } from '@nestjs/swagger';

export class AiUsageByOperationDto {
  @ApiProperty({ description: 'AI operation name' })
  operation!: string;

  @ApiProperty({ description: 'Number of requests for this operation' })
  requests!: number;

  @ApiProperty({ description: 'Total cost as decimal string (precision 12,6)' })
  costUsd!: string;

  @ApiProperty({ description: 'Average latency in milliseconds' })
  avgLatencyMs!: number;
}
