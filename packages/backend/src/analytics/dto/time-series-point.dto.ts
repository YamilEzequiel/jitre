import { ApiProperty } from '@nestjs/swagger';

export class TimeSeriesPointDto {
  @ApiProperty({
    description:
      'ISO period label (day: YYYY-MM-DD, week: YYYY-WNN, month: YYYY-MM)',
  })
  period!: string;

  @ApiProperty({ description: 'Aggregate value for the period' })
  value!: number;
}
