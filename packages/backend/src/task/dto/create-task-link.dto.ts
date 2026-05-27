import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { TASK_LINK_TYPES, TaskLinkType } from '../task-link.entity';

export class CreateTaskLinkDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetTaskId!: string;

  @ApiProperty({ enum: TASK_LINK_TYPES })
  @IsIn(TASK_LINK_TYPES as unknown as string[])
  linkType!: TaskLinkType;
}
