import { ApiProperty } from '@nestjs/swagger';

export class AiUsageByUserDto {
  @ApiProperty({
    description: 'User UUID (no PII — frontend resolves display name)',
  })
  userId!: string;

  @ApiProperty({ description: 'Number of AI requests by this user' })
  requests!: number;

  @ApiProperty({ description: 'Total cost as decimal string (precision 12,6)' })
  costUsd!: string;
}
