import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateWorkspaceDto } from './create-workspace.dto';

/**
 * UpdateWorkspaceDto omits `slug` (immutable after create).
 */
export class UpdateWorkspaceDto extends PartialType(
  OmitType(CreateWorkspaceDto, ['slug'] as const),
) {}
