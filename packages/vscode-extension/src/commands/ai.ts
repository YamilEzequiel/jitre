import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import { resolveTaskContext } from './tasks';

export async function suggestSubtasksCommand(
  client: JitreClient,
  onTaskChange: () => void,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) {
    void vscode.window.showWarningMessage('Pick a task first.');
    return;
  }
  let suggestions: Array<{ title: string; description?: string }>;
  try {
    suggestions = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Asking Jitre AI for subtasks…' },
      async () => {
        const res = await client.suggestSubtasks(ctx.task.id, 5);
        return res.subtasks ?? [];
      },
    );
  } catch (err) {
    void vscode.window.showErrorMessage(`AI request failed: ${(err as Error).message}`);
    return;
  }
  if (!suggestions.length) {
    void vscode.window.showInformationMessage('AI returned no suggestions.');
    return;
  }
  const picks = await vscode.window.showQuickPick(
    suggestions.map((s) => ({
      label: s.title,
      detail: s.description,
      picked: true,
      data: s,
    })),
    {
      title: `Create subtasks for ${ctx.task.title}`,
      canPickMany: true,
      placeHolder: 'Uncheck what you do not want',
    },
  );
  if (!picks || picks.length === 0) return;
  let created = 0;
  for (const p of picks) {
    try {
      await client.createTask(ctx.project.id, {
        title: p.data.title,
        description: p.data.description,
        parentTaskId: ctx.task.id,
      });
      created++;
    } catch (err) {
      void vscode.window.showWarningMessage(
        `Could not create '${p.data.title}': ${(err as Error).message}`,
      );
    }
  }
  onTaskChange();
  void vscode.window.showInformationMessage(`Created ${created} subtask(s).`);
}

export async function generateDescriptionCommand(
  client: JitreClient,
  onTaskChange: () => void,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  const tonePick = await vscode.window.showQuickPick(
    [
      { label: 'technical', detail: 'Crisp, dev-oriented' },
      { label: 'casual', detail: 'Friendlier, looser' },
    ],
    { title: 'Description tone' },
  );
  if (!tonePick) return;

  let description: string;
  let applied = false;
  try {
    const res = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Writing description with AI…' },
      () =>
        client.describeTask(ctx.task.id, {
          tone: tonePick.label as 'technical' | 'casual',
          applyToTask: true,
        }),
    );
    description = res.description;
    applied = res.applied;
  } catch (err) {
    void vscode.window.showErrorMessage(`AI request failed: ${(err as Error).message}`);
    return;
  }
  onTaskChange();
  const action = applied ? 'Open task' : 'Apply to task';
  const choice = await vscode.window.showInformationMessage(
    applied
      ? `Description regenerated and applied (${description.length} chars).`
      : 'Description ready (not applied).',
    action,
  );
  if (choice === 'Open task') {
    void vscode.commands.executeCommand('jitre.openTask', {
      project: ctx.project,
      task: ctx.task,
    });
  }
}
