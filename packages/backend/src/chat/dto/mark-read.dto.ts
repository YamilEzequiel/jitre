import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  messageId!: string;
}
