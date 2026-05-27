import { PartialType } from '@nestjs/swagger';
import { CreateAiPromptTemplateDto } from './create-ai-prompt-template.dto';

/**
 * Mutable subset of CreateAiPromptTemplateDto. `operation` is included
 * but the service rejects changes (operation is the partition key for
 * the picker — moving rows between operations would break the default
 * invariant).
 */
export class UpdateAiPromptTemplateDto extends PartialType(CreateAiPromptTemplateDto) {}
