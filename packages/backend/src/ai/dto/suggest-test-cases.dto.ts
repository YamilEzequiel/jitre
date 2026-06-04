import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class SuggestTestCasesDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 15, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15)
  maxSuggestions?: number = 5;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Override which prompt template to use for this call.',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'When true, suggested cases are persisted as new test cases on the task and returned in `created`. When false (default), only `testCases` is returned and nothing is written.',
  })
  @IsOptional()
  @IsBoolean()
  apply?: boolean;
}
