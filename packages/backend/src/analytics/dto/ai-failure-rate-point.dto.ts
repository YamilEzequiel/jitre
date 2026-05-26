import { ApiProperty } from '@nestjs/swagger';

export class AiFailureRatePointDto {
  @ApiProperty({ description: 'ISO period label' })
  period!: string;

  @ApiProperty({ description: 'Total AI requests in period' })
  total!: number;

  @ApiProperty({ description: 'Failed AI requests in period' })
  failures!: number;

  @ApiProperty({ description: 'Failure rate [0,1]; 0 when total = 0' })
  failureRate!: number;
}
