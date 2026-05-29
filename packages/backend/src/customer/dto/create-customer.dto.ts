import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_CUSTOMER_COLOR = '#2563eb';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export class CreateCustomerDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    default: DEFAULT_CUSTOMER_COLOR,
    description: 'Hex color in `#rrggbb` form. Defaults to blue-600.',
  })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_RE, { message: 'color must be a 6-digit hex like #2563eb' })
  color: string = DEFAULT_CUSTOMER_COLOR;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 40,
    description:
      'PrimeIcons class (e.g. pi-building) or a short emoji. Optional.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @IsEmail({}, { message: 'email must be a valid address' })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
