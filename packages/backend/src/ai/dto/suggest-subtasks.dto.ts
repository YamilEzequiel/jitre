import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SuggestSubtasksDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSuggestions?: number = 5;
}
