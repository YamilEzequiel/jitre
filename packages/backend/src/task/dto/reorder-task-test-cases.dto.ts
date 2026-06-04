import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderTaskTestCasesDto {
  @ApiProperty({
    type: [String],
    description:
      'Test case IDs in the desired order. Must include every case belonging to the task.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  orderedIds!: string[];
}
