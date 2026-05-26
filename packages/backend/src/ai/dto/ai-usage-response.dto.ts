import { ApiProperty } from '@nestjs/swagger';

export class AiUsageResponseDto {
  @ApiProperty()
  promptTokens!: number;

  @ApiProperty()
  completionTokens!: number;

  @ApiProperty()
  totalTokens!: number;

  @ApiProperty()
  costUsd!: string;

  @ApiProperty()
  model!: string;
}
