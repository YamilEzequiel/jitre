import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SearchEntityType } from '../search-engine.interface';

export class SearchQueryDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  @IsOptional()
  @IsIn(['comment', 'workspace', 'user', 'task', 'project', 'document'])
  type?: SearchEntityType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}
