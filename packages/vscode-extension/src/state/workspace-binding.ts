import * as vscode from 'vscode';
import * as path from 'path';

const CONFIG_RELATIVE = '.jitre/config.json';

export interface WorkspaceBinding {
  workspaceId: string;
  projectId: string;
  projectKey?: string;
  projectName?: string;
}

export class WorkspaceBindingStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private cache = new Map<string, WorkspaceBinding>();

  constructor() {
    // Reload on workspace folder changes.
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.cache.clear();
      void this.loadAll().then(() => this._onDidChange.fire());
    });
  }

  async loadAll(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    await Promise.all(folders.map((f) => this.load(f)));
  }

  async load(folder: vscode.WorkspaceFolder): Promise<WorkspaceBinding | null> {
    const uri = vscode.Uri.joinPath(folder.uri, CONFIG_RELATIVE);
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const json = JSON.parse(new TextDecoder().decode(bytes)) as WorkspaceBinding;
      if (json.workspaceId && json.projectId) {
        this.cache.set(folder.uri.toString(), json);
        return json;
      }
    } catch {
      // No binding — silent.
    }
    return null;
  }

  /** Returns the binding for the first matching workspace folder, if any. */
  primary(): WorkspaceBinding | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return null;
    for (const f of folders) {
      const b = this.cache.get(f.uri.toString());
      if (b) return b;
    }
    return null;
  }

  get(folder: vscode.WorkspaceFolder): WorkspaceBinding | null {
    return this.cache.get(folder.uri.toString()) ?? null;
  }

  async write(folder: vscode.WorkspaceFolder, binding: WorkspaceBinding): Promise<void> {
    const dirUri = vscode.Uri.joinPath(folder.uri, '.jitre');
    const fileUri = vscode.Uri.joinPath(folder.uri, CONFIG_RELATIVE);
    try {
      await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
      // already exists
    }
    const payload = JSON.stringify(
      {
        $schema:
          'https://github.com/YamilEzequiel/jitre/blob/main/packages/vscode-extension/jitre-binding.schema.json',
        ...binding,
      },
      null,
      2,
    );
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(payload + '\n'));
    this.cache.set(folder.uri.toString(), binding);
    this._onDidChange.fire();
  }

  async clear(folder: vscode.WorkspaceFolder): Promise<void> {
    const fileUri = vscode.Uri.joinPath(folder.uri, CONFIG_RELATIVE);
    try {
      await vscode.workspace.fs.delete(fileUri);
    } catch {
      // missing — fine
    }
    this.cache.delete(folder.uri.toString());
    this._onDidChange.fire();
  }

  /** Convenience: returns "folder display name" for messages. */
  static folderLabel(folder: vscode.WorkspaceFolder): string {
    return folder.name || path.basename(folder.uri.fsPath);
  }
}
