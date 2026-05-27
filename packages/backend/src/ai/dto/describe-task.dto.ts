import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export class DescribeTaskDto {
  @ApiPropertyOptional({
    enum: ['formal', 'casual', 'technical'],
    default: 'technical',
  })
  @IsOptional()
  @IsIn(['formal', 'casual', 'technical'])
  tone?: 'formal' | 'casual' | 'technical' = 'technical';

  @ApiPropertyOptional({
    default: true,
    description: 'If false, just return suggestion without updating task',
  })
  @IsOptional()
  @IsBoolean()
  applyToTask?: boolean = true;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Override which prompt template to use. When omitted, the workspace's default for `describe` is picked, or the platform-default heuristic is used as a final fallback.",
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
