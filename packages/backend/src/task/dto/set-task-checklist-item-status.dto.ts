import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TASK_CHECKLIST_ITEM_STATUSES, TaskChecklistItemStatus } from '@jitre/shared';

export class SetTaskChecklistItemStatusDto {
  @ApiProperty({ enum: TASK_CHECKLIST_ITEM_STATUSES })
  @IsIn(TASK_CHECKLIST_ITEM_STATUSES as unknown as string[])
  status!: TaskChecklistItemStatus;
}
