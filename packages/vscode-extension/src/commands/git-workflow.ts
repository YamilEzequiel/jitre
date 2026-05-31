import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type { ProjectSummary, TaskSummary } from '../api/types';
import { WorkspaceBindingStore } from '../state/workspace-binding';
import {
  getPrimaryRepository,
  parseTaskKeyFromBranch,
  slugify,
  suggestBranchName,
  type BranchKind,
} from '../util/git';
import { resolveTaskContext } from './tasks';

const BRANCH_KINDS: BranchKind[] = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test'];

async function pickProject(
  client: JitreClient,
  binding: ReturnType<WorkspaceBindingStore['primary']>,
): Promise<ProjectSummary | null> {
  const projects = await client.listProjects();
  if (binding) {
    const bound = projects.find((p) => p.id === binding.projectId);
    if (bound) return bound;
  }
  const pick = await vscode.window.showQuickPick(
    projects.map((p) => ({ label: p.name, description: p.key, project: p })),
    { title: 'Pick a project', placeHolder: 'Project' },
  );
  return pick?.project ?? null;
}

export async function bindFolderToProjectCommand(
  client: JitreClient,
  bindings: WorkspaceBindingStore,
): Promise<void> {
  if (!client.isSignedIn()) {
    void vscode.window.showWarningMessage('Sign in first.');
    return;
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    void vscode.window.showWarningMessage('Open a folder first.');
    return;
  }
  let folder: vscode.WorkspaceFolder | undefined;
  if (folders.length === 1) {
    folder = folders[0];
  } else {
    const pick = await vscode.window.showQuickPick(
      folders.map((f) => ({
        label: WorkspaceBindingStore.folderLabel(f),
        description: f.uri.fsPath,
        folder: f,
      })),
      { title: 'Bind which folder?' },
    );
    folder = pick?.folder;
  }
  if (!folder) return;

  const projects = await client.listProjects();
  const pick = await vscode.window.showQuickPick(
    projects.map((p) => ({
      label: p.name,
      description: p.key,
      detail: p.description ?? '',
      project: p,
    })),
    { title: `Bind '${WorkspaceBindingStore.folderLabel(folder)}' to project` },
  );
  if (!pick) return;

  const ws = client.getWorkspace();
  if (!ws) return;
  await bindings.write(folder, {
    workspaceId: ws.id,
    projectId: pick.project.id,
    projectKey: pick.project.key,
    projectName: pick.project.name,
  });
  void vscode.window.showInformationMessage(
    `Bound to ${pick.project.name}. Created .jitre/config.json.`,
  );
}

export async function unbindFolderCommand(bindings: WorkspaceBindingStore): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  for (const f of folders) {
    await bindings.clear(f);
  }
  void vscode.window.showInformationMessage('Removed .jitre/config.json from all folders.');
}

export async function createBranchFromTaskCommand(
  client: JitreClient,
  bindings: WorkspaceBindingStore,
  arg: unknown,
): Promise<void> {
  const repo = await getPrimaryRepository();
  if (!repo) {
    void vscode.window.showErrorMessage('No git repository in this workspace.');
    return;
  }
  let task: TaskSummary | null = null;
  const ctx = resolveTaskContext(arg);
  if (ctx) {
    task = ctx.task;
  } else {
    const project = await pickProject(client, bindings.primary());
    if (!project) return;
    const tasks = await client.listProjectTasks(project.id);
    const pick = await vscode.window.showQuickPick(
      tasks.map((t) => ({
        label: t.title,
        description: t.key,
        detail: t.description?.slice(0, 100) ?? '',
        task: t,
      })),
      { title: 'Create branch from task' },
    );
    if (!pick) return;
    task = pick.task;
  }
  if (!task) return;

  const kindPick = await vscode.window.showQuickPick(
    BRANCH_KINDS.map((k) => ({ label: k })),
    { title: 'Branch type', placeHolder: 'feat / fix / chore / …' },
  );
  if (!kindPick) return;

  const defaultName = suggestBranchName(
    kindPick.label as BranchKind,
    task.key ?? null,
    task.title,
  );
  const name = await vscode.window.showInputBox({
    title: 'Branch name',
    value: defaultName,
    ignoreFocusOut: true,
    validateInput: (v) =>
      /^[A-Za-z0-9._/-]+$/.test(v.trim()) ? null : 'Invalid git branch name.',
  });
  if (!name) return;

  try {
    await repo.createBranch(name.trim(), true);
    void vscode.window.showInformationMessage(`Switched to branch ${name.trim()}.`);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Failed to create branch: ${(err as Error).message}`,
    );
  }
}

export async function commitWithTaskRefCommand(): Promise<void> {
  const repo = await getPrimaryRepository();
  if (!repo) {
    void vscode.window.showErrorMessage('No git repository in this workspace.');
    return;
  }
  const branch = repo.state.HEAD?.name ?? '';
  const key = parseTaskKeyFromBranch(branch);
  if (!key) {
    void vscode.window.showWarningMessage(
      `Could not detect a task key in '${branch || 'detached HEAD'}'. Rename your branch (e.g. feat/JIT-123-foo).`,
    );
    return;
  }
  const current = repo.inputBox.value ?? '';
  if (current.startsWith(`[${key}]`) || current.includes(`(${key})`) || current.includes(` ${key} `)) {
    void vscode.window.showInformationMessage(`Commit message already references ${key}.`);
    return;
  }
  const trimmed = current.trim();
  repo.inputBox.value = trimmed ? `[${key}] ${trimmed}` : `[${key}] `;
  void vscode.commands.executeCommand('workbench.view.scm');
  void vscode.window.showInformationMessage(
    `Prepended [${key}] to the commit message. Hit Ctrl+Enter in the SCM input to commit.`,
  );
}

export async function createTaskFromSelectionCommand(
  client: JitreClient,
  bindings: WorkspaceBindingStore,
  onTaskChange: () => void,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('Open a file first.');
    return;
  }
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection).trim();
  const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
  const lineRef = selection.isEmpty
    ? `${filePath}:${selection.active.line + 1}`
    : `${filePath}:${selection.start.line + 1}-${selection.end.line + 1}`;

  const title = await vscode.window.showInputBox({
    title: 'New task from code',
    prompt: 'Title',
    value: selection.isEmpty
      ? `TODO at ${filePath}`
      : selectedText.split('\n')[0].slice(0, 80),
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? null : 'Required.'),
  });
  if (!title) return;

  const lang = editor.document.languageId;
  const codeBlock = selectedText
    ? `\n\n\`\`\`${lang}\n${selectedText}\n\`\`\``
    : '';
  const description = `From \`${lineRef}\`${codeBlock}`;

  const project = await pickProject(client, bindings.primary());
  if (!project) return;

  try {
    const created = await client.createTask(project.id, {
      title: title.trim(),
      description,
    });
    onTaskChange();
    const action = 'Open task';
    const choice = await vscode.window.showInformationMessage(
      `Created ${created.key ?? created.id} — ${created.title}`,
      action,
    );
    if (choice === action) {
      void vscode.commands.executeCommand('jitre.openTask', {
        project,
        task: created,
      });
    }
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export function activeBranchTaskKey(branch: string | null | undefined): string | null {
  return parseTaskKeyFromBranch(branch);
}

export function exportSlugify(s: string): string {
  return slugify(s);
}
