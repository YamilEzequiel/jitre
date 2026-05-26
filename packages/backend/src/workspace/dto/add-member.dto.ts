import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { WorkspaceRole } from '@jitre/shared';

export class AddMemberDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: WorkspaceRole })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
