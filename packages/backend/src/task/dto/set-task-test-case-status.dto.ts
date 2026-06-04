import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TASK_TEST_CASE_STATUSES, TaskTestCaseStatus } from '@jitre/shared';

export class SetTaskTestCaseStatusDto {
  @ApiProperty({ enum: TASK_TEST_CASE_STATUSES })
  @IsIn(TASK_TEST_CASE_STATUSES as unknown as string[])
  status!: TaskTestCaseStatus;
}
