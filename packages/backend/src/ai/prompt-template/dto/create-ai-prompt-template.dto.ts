import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AiPromptOperation } from '../ai-prompt-template.entity';

const OPERATIONS = ['describe', 'suggest_subtasks', 'summary', 'generate_draft'] as const;

export class CreateAiPromptTemplateDto {
  @ApiProperty({ enum: OPERATIONS })
  @IsIn(OPERATIONS as unknown as string[])
  operation!: AiPromptOperation;

  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  systemPrompt!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  userTemplate!: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
