import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}
