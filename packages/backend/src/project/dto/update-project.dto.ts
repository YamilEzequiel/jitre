import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

/**
 * UpdateProjectDto omits `key` (immutable after create — ADR-D8).
 */
export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, ['key'] as const),
) {}
