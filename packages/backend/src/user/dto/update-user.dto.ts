import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ format: 'email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailMentions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailAssignments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailDueDates?: boolean;
}
