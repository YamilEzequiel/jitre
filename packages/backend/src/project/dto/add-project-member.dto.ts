import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum } from 'class-validator';
import { ProjectRole } from '@jitre/shared';

export class AddProjectMemberDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  userId!: string;

  @ApiProperty({ enum: ProjectRole })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
