import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddTaskLabelDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  labelId!: string;
}
