import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTransitionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromStatusId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toStatusId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAssignee?: boolean;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;
}
