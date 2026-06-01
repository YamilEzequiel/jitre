import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderTaskChecklistItemsDto {
  @ApiProperty({
    type: [String],
    description: 'Checklist item IDs in the desired order. Must include every item belonging to the task.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  orderedIds!: string[];
}
