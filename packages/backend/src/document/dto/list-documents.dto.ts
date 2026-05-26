import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Query DTO for listing documents.
 *
 * - `parentId` omitted → returns every document of the workspace (optionally
 *   scoped by `projectId`).
 * - `parentId="null"` (literal string) or `parentId=""` → returns root-level
 *   documents (i.e. `parentId IS NULL`).
 * - `parentId=<uuid>` → returns the direct children of that document.
 */
export class ListDocumentsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description:
      'Parent document id. Pass the literal string "null" to filter root-level documents.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'null' || value === '' || value === null) return null;
    return value as string;
  })
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Free-text search across title/contentText' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
