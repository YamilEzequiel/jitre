import { IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AiGenerateDraftContextDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class AiGenerateDraftDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt!: string;

  @IsOptional()
  @IsObject()
  context?: AiGenerateDraftContextDto;
}
