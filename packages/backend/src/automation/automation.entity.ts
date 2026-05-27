import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../common/entities/tenant.entity';

/**
 * Trigger taxonomy — what kicks off a rule.
 *
 * Names mirror the platform's domain events (see EventBus emissions) so the
 * listener can route incoming events directly without an intermediate map.
 */
export type AutomationTrigger =
  | 'task.created'
  | 'task.status_changed'
  | 'task.assigned'
  | 'task.priority_changed'
  | 'task.due_soon';

/**
 * Condition shape — every entry narrows the trigger.
 *
 * Example: `{ field: 'priority', op: 'eq', value: 'urgent' }` after
 * `task.created` means "only fire when the new task is urgent".
 */
export interface AutomationCondition {
  field: string;
  op: 'eq' | 'neq' | 'in' | 'not_in' | 'changed_to' | 'changed_from';
  value: unknown;
}

/**
 * Action shape — what to do when the rule fires. Action implementations live
 * in AutomationActionRegistry; the `type` here is the registry key.
 */
export interface AutomationAction {
  type:
    | 'assign_to_user'
    | 'set_priority'
    | 'set_status'
    | 'add_label'
    | 'add_comment'
    | 'notify_user';
  params: Record<string, unknown>;
}

@Entity('automations')
@Index(['workspaceId', 'trigger', 'enabled'])
export class AutomationEntity extends TenantEntity {
  @Column({ type: 'uuid', name: 'project_id' })
  projectId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 40 })
  trigger!: AutomationTrigger;

  @Column({ type: 'jsonb', name: 'trigger_config', nullable: true })
  triggerConfig!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  conditions!: AutomationCondition[] | null;

  @Column({ type: 'jsonb' })
  actions!: AutomationAction[];
}

@Entity('automation_runs')
@Index(['automationId', 'triggeredAt'])
export class AutomationRunEntity {
  @Column({ type: 'uuid', primary: true, default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'automation_id' })
  automationId!: string;

  @Column({ type: 'timestamptz', name: 'triggered_at', default: () => 'now()' })
  triggeredAt!: Date;

  @Column({ type: 'varchar', length: 20 })
  status!: 'success' | 'error' | 'skipped';

  @Column({ type: 'jsonb', nullable: true })
  context!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;
}
