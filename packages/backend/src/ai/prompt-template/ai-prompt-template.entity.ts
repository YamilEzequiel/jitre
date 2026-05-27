import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * Operation slots the prompt-template system covers. Each row is bound
 * to one operation. The controllers that produce prompts for that
 * operation will pick the workspace default if present, else fall back
 * to the hard-coded prompt (so installs without templates keep working).
 */
export type AiPromptOperation =
  | 'describe'
  | 'suggest_subtasks'
  | 'summary'
  | 'generate_draft';

@Entity('ai_prompt_templates')
// Listing flows hit (workspace, operation) so this is the hot path.
@Index(['workspaceId', 'operation'])
// Enforce one default per (workspace, operation) at the application
// layer; we still ask the DB for a partial unique via migration.
@Index('ux_ai_prompt_templates_default_per_op', ['workspaceId', 'operation'], {
  unique: true,
  where: '"is_default" = true AND "deleted_at" IS NULL',
})
export class AiPromptTemplateEntity extends TenantEntity {
  @ApiProperty({
    enum: ['describe', 'suggest_subtasks', 'summary', 'generate_draft'],
  })
  @Column({ type: 'text' })
  operation!: AiPromptOperation;

  @ApiProperty({ description: 'Human-readable label shown in the UI.' })
  @Column({ type: 'text' })
  name!: string;

  @ApiProperty({ description: 'Short description for the template picker.' })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** System prompt; supports {{variable}} interpolation. */
  @ApiProperty()
  @Column({ name: 'system_prompt', type: 'text' })
  systemPrompt!: string;

  /** User prompt body; supports {{variable}} interpolation. */
  @ApiProperty()
  @Column({ name: 'user_template', type: 'text' })
  userTemplate!: string;

  /**
   * Names of the variables the template expects (so the UI can render
   * which placeholders are required). Provider-agnostic: the resolver
   * just substitutes by name.
   */
  @ApiProperty({ type: [String] })
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  variables!: string[];

  /**
   * One template per (workspace, operation) carries this flag. Picker
   * uses it when the caller doesn't specify a template id explicitly.
   */
  @ApiProperty()
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  /**
   * Built-in templates are seeded by the platform and marked read-only
   * in the UI. Custom templates can be edited / deleted by workspace
   * admins.
   */
  @ApiProperty()
  @Column({ name: 'is_builtin', type: 'boolean', default: false })
  isBuiltin!: boolean;

  @ApiProperty({ nullable: true })
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;
}
