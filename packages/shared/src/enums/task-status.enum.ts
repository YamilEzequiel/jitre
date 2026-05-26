export enum TaskStatus {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  BLOCKED = 'blocked',
  DONE = 'done',
  CANCELED = 'canceled',
}

export const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.DONE,
  TaskStatus.CANCELED,
]);

export function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.has(status);
}
