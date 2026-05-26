import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDmDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  otherUserId!: string;
}
