import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class WorkloadQueryDto {
  @ApiProperty({
    enum: ['assignee', 'status'],
    description: 'Group by assignee or status',
  })
  @IsIn(['assignee', 'status'])
  groupBy!: 'assignee' | 'status';

  @ApiPropertyOptional({
    description: 'Filter to a specific project (UUID v4)',
  })
  @IsOptional()
  @IsUUID('4')
  projectId?: string;
}
