import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    minLength: 2,
    maxLength: 40,
    description: 'URL-safe slug: lowercase letters, digits, hyphens.',
    example: 'my-team',
  })
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, {
    message: 'slug must be lowercase letters/digits/hyphens (2–40 chars)',
  })
  slug!: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
