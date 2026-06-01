/**
 * Lifecycle of a single checklist item (a.k.a. acceptance criterion / QA case)
 * attached to a task.
 *
 * - `pending`  — not validated yet (default on create)
 * - `passed`   — QA marked the criterion as met
 * - `failed`   — QA marked the criterion as broken; usually surfaces a regression
 * - `blocked`  — cannot be validated because of an external dependency
 */
export enum TaskChecklistItemStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  BLOCKED = 'blocked',
}

export const TASK_CHECKLIST_ITEM_STATUSES: readonly TaskChecklistItemStatus[] = [
  TaskChecklistItemStatus.PENDING,
  TaskChecklistItemStatus.PASSED,
  TaskChecklistItemStatus.FAILED,
  TaskChecklistItemStatus.BLOCKED,
] as const;

export function isTerminalChecklistItemStatus(
  status: TaskChecklistItemStatus,
): boolean {
  return (
    status === TaskChecklistItemStatus.PASSED ||
    status === TaskChecklistItemStatus.FAILED
  );
}
