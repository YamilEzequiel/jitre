/**
 * Lifecycle of a single Test Case attached to a task.
 *
 * Test Cases differ from Checklist items in that they carry structured fields
 * (precondition / steps / expected) and an additional `skipped` outcome for
 * scenarios deliberately not executed in this run.
 *
 * - `pending`  — not executed yet (default on create)
 * - `passed`   — execution matched the expected result
 * - `failed`   — execution did not match the expected result
 * - `blocked`  — cannot be executed because of an external dependency
 * - `skipped`  — intentionally not run in this iteration (out of scope)
 */
export enum TaskTestCaseStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped',
}

export const TASK_TEST_CASE_STATUSES: readonly TaskTestCaseStatus[] = [
  TaskTestCaseStatus.PENDING,
  TaskTestCaseStatus.PASSED,
  TaskTestCaseStatus.FAILED,
  TaskTestCaseStatus.BLOCKED,
  TaskTestCaseStatus.SKIPPED,
] as const;

export function isTerminalTestCaseStatus(status: TaskTestCaseStatus): boolean {
  return (
    status === TaskTestCaseStatus.PASSED ||
    status === TaskTestCaseStatus.FAILED ||
    status === TaskTestCaseStatus.SKIPPED
  );
}
