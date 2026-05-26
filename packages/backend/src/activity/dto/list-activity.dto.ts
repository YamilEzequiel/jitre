import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListActivityDto {
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  subjectType?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  pageSize: number = 20;
}
