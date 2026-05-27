import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChannelDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    maxLength: 8,
    nullable: true,
    description:
      'Single emoji (or short string) to display next to the channel name. ' +
      'Pass null or empty string to clear it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string | null;
}
