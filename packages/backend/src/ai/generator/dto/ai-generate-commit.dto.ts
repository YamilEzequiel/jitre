import { IsDefined, IsObject } from 'class-validator';
import type { AiGeneratorDraft } from '@jitre/shared';

/**
 * Commit accepts the entire draft body so the user can edit fields between
 * draft and commit. Shape validation lives in the service — the parser asserts
 * `kind` and required fields before any DB write, matching what the LLM
 * pipeline guarantees.
 */
export class AiGenerateCommitDto {
  @IsDefined()
  @IsObject()
  draft!: AiGeneratorDraft;
}
