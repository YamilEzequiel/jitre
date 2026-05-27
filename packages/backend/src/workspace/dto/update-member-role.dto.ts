import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '@jitre/shared';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: WorkspaceRole })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
