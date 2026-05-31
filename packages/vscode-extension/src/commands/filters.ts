import * as vscode from 'vscode';
import type { StatusCategory, TaskPriority } from '../api/types';
import { MyTasksFilterStore } from '../state/filters';

const CATEGORIES: Array<{ label: string; value: StatusCategory | null }> = [
  { label: 'All statuses', value: null },
  { label: 'To do', value: 'todo' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
];

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none'];

const DUE_OPTIONS: Array<{ label: string; days?: number }> = [
  { label: 'Any due date' },
  { label: 'Overdue or today', days: 0 },
  { label: 'Within 3 days', days: 3 },
  { label: 'Within 7 days', days: 7 },
  { label: 'Within 14 days', days: 14 },
];

export async function configureMyTasksFilterCommand(
  filters: MyTasksFilterStore,
): Promise<void> {
  const current = filters.get();
  const categoryPick = await vscode.window.showQuickPick(
    CATEGORIES.map((c) => ({
      label: c.label,
      picked: c.value === (current.category ?? null),
      value: c.value,
    })),
    { title: 'Filter · status category', canPickMany: false },
  );
  if (!categoryPick) return;

  const priorityPick = await vscode.window.showQuickPick(
    PRIORITIES.map((p) => ({
      label: p,
      picked: current.priorities?.includes(p) ?? false,
    })),
    {
      title: 'Filter · priorities (pick any, leave empty for all)',
      canPickMany: true,
    },
  );
  if (!priorityPick) return;

  const duePick = await vscode.window.showQuickPick(
    DUE_OPTIONS.map((d) => ({
      label: d.label,
      picked: d.days === current.dueWithinDays,
      days: d.days,
    })),
    { title: 'Filter · due date' },
  );
  if (!duePick) return;

  await filters.update({
    category: categoryPick.value ?? undefined,
    priorities: priorityPick.length ? priorityPick.map((p) => p.label as TaskPriority) : undefined,
    dueWithinDays: duePick.days,
  });
  void vscode.window.showInformationMessage(`Filter set: ${filters.describe()}.`);
}

export async function clearMyTasksFilterCommand(filters: MyTasksFilterStore): Promise<void> {
  await filters.reset();
  void vscode.window.showInformationMessage('Filters cleared.');
}
