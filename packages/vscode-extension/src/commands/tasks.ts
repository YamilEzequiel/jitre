import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type {
  ProjectStatus,
  ProjectSummary,
  TaskPriority,
  TaskSummary,
} from '../api/types';
import { TaskNode } from '../tree/projects';
import { MyTaskNode } from '../tree/my-tasks';
import { TaskPanel } from '../webview/task-panel';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none'];

type TaskContext = { project: ProjectSummary; task: TaskSummary };

export function resolveTaskContext(arg: unknown): TaskContext | null {
  if (!arg) return null;
  if (arg instanceof TaskNode) return { project: arg.project, task: arg.task };
  if (arg instanceof MyTaskNode) return { project: arg.project, task: arg.task };
  if (typeof arg === 'object' && arg !== null) {
    const a = arg as { project?: ProjectSummary; task?: TaskSummary };
    if (a.project && a.task) return { project: a.project, task: a.task };
  }
  return null;
}

export async function openTaskCommand(
  context: vscode.ExtensionContext,
  client: JitreClient,
  onTaskChange: () => void,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) {
    void vscode.window.showWarningMessage('No task selected.');
    return;
  }
  const cfg = vscode.workspace.getConfiguration('jitre');
  if (cfg.get<boolean>('openTasksInBrowser')) {
    const web = client.webBaseUrl();
    void vscode.env.openExternal(
      vscode.Uri.parse(`${web}/projects/${ctx.project.id}/tasks/${ctx.task.id}`),
    );
    return;
  }
  await TaskPanel.open(context, client, ctx.project, ctx.task, onTaskChange);
}

export async function openTaskInBrowserCommand(
  client: JitreClient,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  const web = client.webBaseUrl();
  void vscode.env.openExternal(
    vscode.Uri.parse(`${web}/projects/${ctx.project.id}/tasks/${ctx.task.id}`),
  );
}

export async function changeTaskStatusCommand(
  client: JitreClient,
  onTaskChange: () => void,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  let statuses: ProjectStatus[];
  try {
    statuses = await client.listProjectStatuses(ctx.project.id);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed to load statuses: ${(err as Error).message}`);
    return;
  }
  const pick = await vscode.window.showQuickPick(
    statuses
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => ({
        label: s.name,
        description: s.category,
        status: s,
      })),
    { title: `Change status · ${ctx.task.title}`, placeHolder: 'Pick a status' },
  );
  if (!pick) return;
  try {
    await client.changeTaskStatus(ctx.project.id, ctx.task.id, pick.status.id);
    onTaskChange();
    void vscode.window.showInformationMessage(`Task moved to ${pick.status.name}.`);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export async function changeTaskPriorityCommand(
  client: JitreClient,
  onTaskChange: () => void,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  const pick = await vscode.window.showQuickPick(
    PRIORITIES.map((p) => ({ label: p })),
    { title: `Priority · ${ctx.task.title}`, placeHolder: 'Pick a priority' },
  );
  if (!pick) return;
  try {
    await client.updateTask(ctx.project.id, ctx.task.id, {
      priority: pick.label as TaskPriority,
    });
    onTaskChange();
    void vscode.window.showInformationMessage(`Priority set to ${pick.label}.`);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export async function assignTaskCommand(
  client: JitreClient,
  onTaskChange: () => void,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  const workspace = client.getWorkspace();
  if (!workspace) return;
  let members: Awaited<ReturnType<JitreClient['listWorkspaceMembers']>>;
  try {
    members = await client.listWorkspaceMembers(workspace.id);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed to load members: ${(err as Error).message}`);
    return;
  }
  const pick = await vscode.window.showQuickPick(
    members.map((m) => {
      const name = m.displayName ?? m.user?.displayName ?? m.email ?? m.userId ?? m.id;
      const detail = m.email ?? m.user?.email ?? '';
      const userId = m.userId ?? m.user?.id ?? m.id;
      return { label: String(name), description: detail, userId: String(userId) };
    }),
    { title: `Assign · ${ctx.task.title}`, placeHolder: 'Pick a user' },
  );
  if (!pick) return;
  try {
    await client.assignTask(ctx.project.id, ctx.task.id, pick.userId);
    onTaskChange();
    void vscode.window.showInformationMessage(`Assigned to ${pick.label}.`);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export async function completeTaskCommand(
  client: JitreClient,
  onTaskChange: () => void,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  try {
    await client.completeTask(ctx.project.id, ctx.task.id);
    onTaskChange();
    void vscode.window.showInformationMessage(`Marked '${ctx.task.title}' as done.`);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export async function addCommentCommand(
  client: JitreClient,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  if (!ctx) return;
  const body = await vscode.window.showInputBox({
    title: `Comment on '${ctx.task.title}'`,
    prompt: 'Comment body (supports plain text & basic markdown)',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? null : 'Comment cannot be empty.'),
  });
  if (!body) return;
  try {
    await client.addComment(ctx.task.id, body.trim());
    void vscode.window.showInformationMessage('Comment posted.');
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export async function createTaskCommand(
  client: JitreClient,
  onTaskChange: () => void,
  projectArg: unknown,
): Promise<void> {
  let project: ProjectSummary | null = null;
  if (
    projectArg &&
    typeof projectArg === 'object' &&
    'project' in (projectArg as Record<string, unknown>)
  ) {
    project = (projectArg as { project: ProjectSummary }).project;
  } else if (
    projectArg &&
    typeof projectArg === 'object' &&
    'id' in (projectArg as Record<string, unknown>) &&
    'key' in (projectArg as Record<string, unknown>)
  ) {
    project = projectArg as ProjectSummary;
  }
  if (!project) {
    const projects = await client.listProjects();
    const pick = await vscode.window.showQuickPick(
      projects.map((p) => ({ label: p.name, description: p.key, project: p })),
      { title: 'Create task', placeHolder: 'Pick a project' },
    );
    if (!pick) return;
    project = pick.project;
  }
  const title = await vscode.window.showInputBox({
    title: `New task in ${project.name}`,
    prompt: 'Title',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? null : 'Required.'),
  });
  if (!title) return;
  const description = await vscode.window.showInputBox({
    title: `New task in ${project.name}`,
    prompt: 'Description (optional)',
    ignoreFocusOut: true,
  });
  try {
    const created = await client.createTask(project.id, {
      title: title.trim(),
      description: description?.trim() || undefined,
    });
    onTaskChange();
    void vscode.window.showInformationMessage(
      `Created task: ${created.key ?? created.id} — ${created.title}`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}
