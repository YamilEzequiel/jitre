import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;
}
