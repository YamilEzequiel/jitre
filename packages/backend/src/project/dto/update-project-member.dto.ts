import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectRole } from '@jitre/shared';

export class UpdateProjectMemberDto {
  @ApiProperty({ enum: ProjectRole })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
