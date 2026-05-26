import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListNotificationsDto {
  @IsOptional()
  @IsBoolean()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  unreadOnly?: boolean;

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
