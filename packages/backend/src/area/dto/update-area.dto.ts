import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export class UpdateAreaDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    description: 'Hex color in `#rrggbb` form.',
  })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_RE, { message: 'color must be a 6-digit hex like #7c3aed' })
  color?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 40,
    description:
      'PrimeIcons class (e.g. pi-briefcase) or a short emoji. Pass null to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
