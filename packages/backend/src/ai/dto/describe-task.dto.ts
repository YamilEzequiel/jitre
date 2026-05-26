import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

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
}
