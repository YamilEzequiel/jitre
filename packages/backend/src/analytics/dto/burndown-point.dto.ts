import { ApiProperty } from '@nestjs/swagger';

export class BurndownPointDto {
  @ApiProperty({ description: 'Date label YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ description: 'Remaining open tasks at end-of-day' })
  remaining!: number;
}
