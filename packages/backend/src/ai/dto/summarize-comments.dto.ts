import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class SummarizeCommentsDto {
  @ApiProperty({
    type: [String],
    description: 'Comment IDs to summarize (min 2, max 50)',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  commentIds!: string[];
}
