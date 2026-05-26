import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ChangeTaskStatusDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  statusId!: string;
}
