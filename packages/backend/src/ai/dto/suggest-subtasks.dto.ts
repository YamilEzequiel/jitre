import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class SuggestSubtasksDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSuggestions?: number = 5;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Override which prompt template to use for this call.',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
