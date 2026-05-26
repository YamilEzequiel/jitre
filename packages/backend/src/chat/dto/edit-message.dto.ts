import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditMessageDto {
  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;
}
