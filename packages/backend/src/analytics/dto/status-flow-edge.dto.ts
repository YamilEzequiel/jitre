import { ApiProperty } from '@nestjs/swagger';

export class StatusFlowEdgeDto {
  @ApiProperty({ description: 'Source status UUID' })
  fromStatusId!: string;

  @ApiProperty({ description: 'Target status UUID' })
  toStatusId!: string;

  @ApiProperty({ description: 'Transition count' })
  count!: number;
}
