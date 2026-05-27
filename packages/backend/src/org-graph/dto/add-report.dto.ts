import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddReportDto {
  @ApiProperty({ format: 'uuid', description: 'The employee who reports' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ format: 'uuid', description: 'The supervisor receiving the report' })
  @IsUUID()
  supervisorId!: string;
}
