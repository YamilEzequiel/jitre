import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus } from '@jitre/shared';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export class UpdateCustomerDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ description: 'Hex color in `#rrggbb` form.' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_RE, { message: 'color must be a 6-digit hex like #2563eb' })
  color?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 40,
    description:
      'PrimeIcons class (e.g. pi-building) or a short emoji. Pass null to clear.',
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
