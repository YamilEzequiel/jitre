import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TimeReportGroupBy {
  USER = 'user',
  PROJECT = 'project',
  TASK = 'task',
  DATE = 'date',
}

export class TimeReportQueryDto {
  @ApiProperty({ enum: TimeReportGroupBy })
  @IsEnum(TimeReportGroupBy)
  groupBy!: TimeReportGroupBy;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  dateTo!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
