import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import { resolveTaskContext } from './tasks';

export async function copyTaskKeyCommand(arg: unknown): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  const key = ctx.task.key ?? ctx.task.id;
  await vscode.env.clipboard.writeText(key);
  void vscode.window.setStatusBarMessage(`Copied ${key}`, 2500);
}

export async function copyTaskUrlCommand(client: JitreClient, arg: unknown): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  const web = client.webBaseUrl();
  const url = `${web}/projects/${ctx.project.id}/tasks/${ctx.task.id}`;
  await vscode.env.clipboard.writeText(url);
  void vscode.window.setStatusBarMessage('Copied task URL', 2500);
}

export async function openTaskByKeyCommand(
  client: JitreClient,
  openTask: (projectId: string, taskId: string) => Promise<void>,
): Promise<void> {
  const key = await vscode.window.showInputBox({
    title: 'Open task by key or ID',
    prompt: 'e.g. JIT-123 or a UUID',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? null : 'Required.'),
  });
  if (!key) return;
  const q = key.trim();
  // UUID? open directly via /tasks/:id
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
    try {
      const t = await client.getTask(q);
      await openTask(t.projectId, t.id);
      return;
    } catch (err) {
      void vscode.window.showErrorMessage(`Not found: ${(err as Error).message}`);
      return;
    }
  }
  // Key — use search to resolve.
  try {
    const res = await client.search(q, 'task', 5);
    const hit = res.items.find((h) => h.snippet?.includes(q)) ?? res.items[0];
    if (!hit) {
      void vscode.window.showInformationMessage(`No task matching '${q}'.`);
      return;
    }
    const task = await client.getTask(hit.entityId);
    await openTask(task.projectId, task.id);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}
