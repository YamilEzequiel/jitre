import * as vscode from 'vscode';
import { JitreClient } from '../api/client';

// Matches Jira-style keys (PROJ-123). Two-char minimum prefix to avoid
// matching arbitrary "A-1" placeholders in code. Word boundaries on both ends.
const KEY_PATTERN = /\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b/g;

interface ResolvedTask {
  projectId: string;
  taskId: string;
  title: string;
}

export class TaskRefCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private readonly cache = new Map<string, ResolvedTask | 'miss'>();

  constructor(private readonly client: JitreClient) {}

  refresh(): void {
    this.cache.clear();
    this._onDidChangeCodeLenses.fire();
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens[]> {
    if (!this.client.isSignedIn()) return [];
    const cfg = vscode.workspace.getConfiguration('jitre');
    if (cfg.get<boolean>('codeLens.enabled') === false) return [];
    const text = document.getText();
    const seen = new Map<string, vscode.Range>();
    KEY_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = KEY_PATTERN.exec(text))) {
      const key = m[1];
      if (seen.has(key)) continue;
      const start = document.positionAt(m.index);
      const end = document.positionAt(m.index + m[0].length);
      seen.set(key, new vscode.Range(start, end));
      if (seen.size >= 50) break;
    }
    if (seen.size === 0) return [];

    const lenses: vscode.CodeLens[] = [];
    for (const [key, range] of seen) {
      if (token.isCancellationRequested) break;
      const lens = new vscode.CodeLens(range);
      lens.command = {
        title: `$(target) ${key} · loading…`,
        command: 'jitre.openTaskByRef',
        arguments: [key],
      };
      lenses.push(lens);
    }
    return lenses;
  }

  async resolveCodeLens(
    lens: vscode.CodeLens,
    token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens> {
    if (!this.client.isSignedIn() || !lens.command) return lens;
    const key = lens.command.arguments?.[0] as string | undefined;
    if (!key) return lens;

    let resolved = this.cache.get(key);
    if (resolved === undefined) {
      try {
        const res = await this.client.search(key, 'task', 5);
        const hit = res.items.find((h) => h.snippet?.includes(key)) ?? res.items[0];
        if (hit) {
          const task = await this.client.getTask(hit.entityId);
          resolved = {
            projectId: task.projectId,
            taskId: task.id,
            title: task.title,
          };
        } else {
          resolved = 'miss';
        }
      } catch {
        resolved = 'miss';
      }
      this.cache.set(key, resolved);
    }
    if (token.isCancellationRequested) return lens;

    if (resolved === 'miss') {
      lens.command = {
        title: `$(circle-slash) ${key} not found`,
        command: '',
      };
    } else {
      lens.command = {
        title: `$(target) ${key} — ${resolved.title}`,
        command: 'jitre.openTaskByRef',
        arguments: [key, resolved],
      };
    }
    return lens;
  }
}
