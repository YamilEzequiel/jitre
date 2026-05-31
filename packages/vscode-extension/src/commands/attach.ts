import * as vscode from 'vscode';
import * as path from 'path';
import { JitreClient } from '../api/client';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.log': 'text/plain',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
};

function guessMime(filename: string): string {
  return MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

export async function attachFileToTaskCommand(
  client: JitreClient,
  fileUriArg: unknown,
): Promise<void> {
  if (!client.isSignedIn()) {
    void vscode.window.showWarningMessage('Sign in first.');
    return;
  }
  let fileUri: vscode.Uri | null = null;
  if (fileUriArg instanceof vscode.Uri) {
    fileUri = fileUriArg;
  } else {
    const pick = await vscode.window.showOpenDialog({
      title: 'Pick a file to attach',
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
    });
    if (!pick || pick.length === 0) return;
    fileUri = pick[0];
  }
  if (!fileUri) return;
  // Pick task across workspace via the user's assigned tasks (or all if needed).
  const user = client.getUser();
  if (!user) return;
  const projects = await client.listProjects();
  const groups = await Promise.all(
    projects.map(async (p) => {
      const tasks = await client.listProjectTasks(p.id).catch(() => []);
      return tasks.map((t) => ({ project: p, task: t }));
    }),
  );
  const flat = groups.flat();
  if (flat.length === 0) {
    void vscode.window.showInformationMessage('No tasks available.');
    return;
  }
  const pick = await vscode.window.showQuickPick(
    flat.map((g) => ({
      label: g.task.title,
      description: `${g.project.key} · ${g.task.key ?? ''}`,
      detail: g.task.description?.slice(0, 100),
      ctx: g,
    })),
    { title: `Attach ${path.basename(fileUri.fsPath)} to which task?` },
  );
  if (!pick) return;

  try {
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const filename = path.basename(fileUri.fsPath);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Uploading ${filename}…`,
      },
      () =>
        client.uploadAttachment('task', pick.ctx.task.id, {
          name: filename,
          mimeType: guessMime(filename),
          bytes,
        }),
    );
    void vscode.window.showInformationMessage(
      `Attached ${filename} to '${pick.ctx.task.title}'.`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}
