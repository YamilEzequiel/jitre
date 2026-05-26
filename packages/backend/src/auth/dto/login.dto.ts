import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo@jitre.local', format: 'email' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'sup3rs3cret', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
