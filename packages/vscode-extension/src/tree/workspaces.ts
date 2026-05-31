import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type { ProjectSummary, TaskSummary } from '../api/types';
import { WorkspaceBindingStore } from '../state/workspace-binding';
import { getCurrentBranch, parseTaskKeyFromBranch } from '../util/git';

type Node = InfoNode | ActiveTaskNode | BindingNode;

class InfoNode {
  readonly kind = 'info' as const;
  constructor(
    public readonly label: string,
    public readonly description?: string,
    public readonly icon?: string,
    public readonly tooltip?: string,
  ) {}
}

class BindingNode {
  readonly kind = 'binding' as const;
  constructor(public readonly project: ProjectSummary | null) {}
}

class ActiveTaskNode {
  readonly kind = 'active-task' as const;
  constructor(
    public readonly project: ProjectSummary,
    public readonly task: TaskSummary,
    public readonly branch: string,
  ) {}
}

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private branch: string | null = null;
  private activeTask: { project: ProjectSummary; task: TaskSummary } | null = null;

  constructor(
    private readonly client: JitreClient,
    private readonly bindings: WorkspaceBindingStore,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async refreshActiveTask(): Promise<void> {
    this.activeTask = null;
    this.branch = await getCurrentBranch();
    const key = parseTaskKeyFromBranch(this.branch);
    if (!key || !this.client.isSignedIn()) {
      this.refresh();
      return;
    }
    try {
      const result = await this.client.search(key, 'task', 5);
      const exact = result.items.find((h) => h.snippet?.includes(key));
      const hit = exact ?? result.items[0];
      if (hit) {
        const task = await this.client.getTask(hit.entityId);
        const project = await this.client.getProject(task.projectId);
        this.activeTask = { project, task };
      }
    } catch {
      // Could not resolve — leave null.
    }
    this.refresh();
  }

  getActiveTask(): { project: ProjectSummary; task: TaskSummary } | null {
    return this.activeTask;
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'info') {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.description = node.description;
      item.tooltip = node.tooltip;
      if (node.icon) item.iconPath = new vscode.ThemeIcon(node.icon);
      return item;
    }
    if (node.kind === 'binding') {
      if (!node.project) {
        const item = new vscode.TreeItem(
          'Folder not bound',
          vscode.TreeItemCollapsibleState.None,
        );
        item.description = 'Click to bind';
        item.iconPath = new vscode.ThemeIcon('link');
        item.tooltip = 'Save .jitre/config.json to default all commands to a project.';
        item.command = { command: 'jitre.bindFolderToProject', title: 'Bind' };
        return item;
      }
      const item = new vscode.TreeItem(
        node.project.name,
        vscode.TreeItemCollapsibleState.None,
      );
      item.description = `bound · ${node.project.key}`;
      item.iconPath = new vscode.ThemeIcon('repo');
      item.tooltip = '.jitre/config.json — click to change project.';
      item.command = { command: 'jitre.bindFolderToProject', title: 'Re-bind' };
      return item;
    }
    // active-task
    const t = node.task;
    const item = new vscode.TreeItem(t.title, vscode.TreeItemCollapsibleState.None);
    item.description = `${t.key ?? ''} · branch ${node.branch}`;
    item.iconPath = new vscode.ThemeIcon('target');
    item.contextValue = 'jitre.task';
    item.tooltip = `Linked to current git branch '${node.branch}'.`;
    item.command = {
      command: 'jitre.openTask',
      title: 'Open task',
      arguments: [{ project: node.project, task: node.task }],
    };
    return item;
  }

  async getChildren(): Promise<Node[]> {
    const user = this.client.getUser();
    const ws = this.client.getWorkspace();
    const out: Node[] = [];
    if (ws) {
      out.push(new InfoNode(ws.name, ws.role, 'organization'));
    }
    if (user) {
      out.push(new InfoNode(user.displayName, user.email, 'account'));
    }
    if (!ws && !user) {
      out.push(new InfoNode('Not signed in', undefined, 'sign-in'));
      return out;
    }
    const binding = this.bindings.primary();
    let bindingProject: ProjectSummary | null = null;
    if (binding) {
      try {
        bindingProject = await this.client.getProject(binding.projectId);
      } catch {
        bindingProject = {
          id: binding.projectId,
          key: binding.projectKey ?? '?',
          name: binding.projectName ?? '(unknown project)',
        } as ProjectSummary;
      }
    }
    out.push(new BindingNode(bindingProject));

    if (this.activeTask) {
      out.push(
        new ActiveTaskNode(
          this.activeTask.project,
          this.activeTask.task,
          this.branch ?? '',
        ),
      );
    } else if (this.branch) {
      const key = parseTaskKeyFromBranch(this.branch);
      if (key) {
        out.push(
          new InfoNode(
            `No task matching ${key}`,
            this.branch,
            'git-branch',
            'Branch contains a task key but the task could not be located.',
          ),
        );
      } else {
        out.push(
          new InfoNode(this.branch, 'no task key', 'git-branch'),
        );
      }
    }
    return out;
  }
}
