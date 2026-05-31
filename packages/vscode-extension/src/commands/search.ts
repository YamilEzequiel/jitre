import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type { ProjectSummary, TaskSummary } from '../api/types';

export async function searchTasksCommand(
  client: JitreClient,
  openTask: (project: ProjectSummary, task: TaskSummary) => void,
): Promise<void> {
  if (!client.isSignedIn()) {
    void vscode.window.showWarningMessage('Sign in first.');
    return;
  }
  const q = await vscode.window.showInputBox({
    title: 'Jitre: Search tasks',
    prompt: 'Type a query',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? null : 'Required.'),
  });
  if (!q) return;

  let result;
  try {
    result = await client.search(q.trim(), 'task', 30);
  } catch (err) {
    void vscode.window.showErrorMessage(`Search failed: ${(err as Error).message}`);
    return;
  }

  if (!result.items?.length) {
    void vscode.window.showInformationMessage('No matches.');
    return;
  }

  const projects = await client.listProjects().catch(() => [] as ProjectSummary[]);
  const projectIndex = new Map(projects.map((p) => [p.id, p]));

  const pick = await vscode.window.showQuickPick(
    result.items.map((hit) => ({
      label: hit.snippet?.slice(0, 80) || `task ${hit.entityId}`,
      description: hit.parentType === 'project' && hit.parentId
        ? projectIndex.get(hit.parentId)?.key
        : undefined,
      detail: `rank ${hit.rank.toFixed(2)} · ${hit.occurredAt}`,
      hit,
    })),
    { title: `Results for "${q.trim()}"`, placeHolder: 'Pick a task to open' },
  );
  if (!pick) return;

  try {
    const task = await client.getTask(pick.hit.entityId);
    const project = projectIndex.get(task.projectId);
    if (!project) {
      void vscode.window.showWarningMessage(
        'Could not locate the project for that task.',
      );
      return;
    }
    openTask(project, task);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed to open: ${(err as Error).message}`);
  }
}
