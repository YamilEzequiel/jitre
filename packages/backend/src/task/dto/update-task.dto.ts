import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

/**
 * UpdateTaskDto omits statusId (separate endpoint), assigneeUserIds, labelIds, parentTaskId.
 */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, [
    'statusId',
    'assigneeUserIds',
    'labelIds',
    'parentTaskId',
  ] as const),
) {}
