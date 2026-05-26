import { ApiProperty } from '@nestjs/swagger';

export class WorkloadBucketDto {
  @ApiProperty({
    description: 'Bucket key: userId, statusId, or "__unassigned__"',
  })
  key!: string;

  @ApiProperty({ description: 'Open task count for this bucket' })
  count!: number;
}
