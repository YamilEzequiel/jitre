import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const TRIGGERS = [
  'task.created',
  'task.status_changed',
  'task.assigned',
  'task.priority_changed',
  'task.due_soon',
] as const;

export class CreateAutomationDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ enum: TRIGGERS })
  @IsIn(TRIGGERS as unknown as string[])
  trigger!: (typeof TRIGGERS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  conditions?: Array<{ field: string; op: string; value: unknown }> | null;

  @ApiProperty({ type: [Object] })
  @IsArray()
  actions!: Array<{ type: string; params: Record<string, unknown> }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
