import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_AREA_COLOR = '#7c3aed';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export class CreateAreaDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    default: DEFAULT_AREA_COLOR,
    description: 'Hex color in `#rrggbb` form. Defaults to violet.',
  })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_RE, { message: 'color must be a 6-digit hex like #7c3aed' })
  color: string = DEFAULT_AREA_COLOR;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 40,
    description:
      'PrimeIcons class (e.g. pi-briefcase) or a short emoji. Optional.',
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
