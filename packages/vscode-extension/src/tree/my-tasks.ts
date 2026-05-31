import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type {
  ProjectStatus,
  ProjectSummary,
  StatusCategory,
  TaskPriority,
  TaskSummary,
} from '../api/types';
import { formatTaskDescription } from './projects';
import { MyTasksFilterStore } from '../state/filters';

type Node = MyTaskNode | MessageNode;

export class MyTaskNode {
  readonly kind = 'task' as const;
  constructor(
    public readonly project: ProjectSummary,
    public readonly task: TaskSummary,
  ) {}
}

class MessageNode {
  readonly kind = 'message' as const;
  constructor(public readonly label: string) {}
}

const PRIORITY_ICON: Record<TaskPriority, string> = {
  urgent: 'flame',
  high: 'arrow-up',
  medium: 'dash',
  low: 'arrow-down',
  none: 'circle-outline',
};

export class MyTasksTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private cache: MyTaskNode[] | null = null;

  constructor(
    private readonly client: JitreClient,
    private readonly filters: MyTasksFilterStore,
  ) {
    filters.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.cache = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'message') {
      return new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    }
    const item = new vscode.TreeItem(
      node.task.title,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = `${node.project.key} · ${formatTaskDescription(node.task)}`;
    item.contextValue = 'jitre.task';
    item.iconPath = new vscode.ThemeIcon(
      PRIORITY_ICON[(node.task.priority ?? 'none') as TaskPriority],
    );
    item.tooltip = `${node.project.name} — ${node.task.title}`;
    item.command = {
      command: 'jitre.openTask',
      title: 'Open task',
      arguments: [{ project: node.project, task: node.task }],
    };
    return item;
  }

  async getChildren(): Promise<Node[]> {
    if (!this.client.isSignedIn()) return [];
    const user = this.client.getUser();
    if (!user) return [];
    try {
      if (!this.cache) {
        const projects = await this.client.listProjects();
        const all = await Promise.all(
          projects.map(async (p) => {
            try {
              const [tasks, statuses] = await Promise.all([
                this.client.listProjectTasks(p.id, { assigneeUserId: user.id }),
                this.client.listProjectStatuses(p.id).catch(() => [] as ProjectStatus[]),
              ]);
              const filtered = this.applyFilters(tasks, statuses);
              return filtered.map((t) => new MyTaskNode(p, t));
            } catch {
              return [] as MyTaskNode[];
            }
          }),
        );
        this.cache = all.flat();
      }
      const header: Node[] = [];
      if (this.filters.isActive()) {
        const msg = new MessageNode(`Filter: ${this.filters.describe()}`);
        header.push(msg);
      }
      if (this.cache.length === 0) {
        header.push(new MessageNode(
          this.filters.isActive() ? 'No tasks match your filter.' : 'Nothing assigned to you. 🎉',
        ));
        return header;
      }
      return [...header, ...this.cache];
    } catch (err) {
      return [new MessageNode(`Error: ${(err as Error).message}`)];
    }
  }

  private applyFilters(tasks: TaskSummary[], statuses: ProjectStatus[]): TaskSummary[] {
    const f = this.filters.get();
    const statusMap = new Map(statuses.map((s) => [s.id, s]));
    const now = Date.now();
    return tasks.filter((t) => {
      if (f.category) {
        const s = t.statusId ? statusMap.get(t.statusId) : undefined;
        const cat: StatusCategory | undefined = s?.category ?? t.status?.category;
        if (cat !== f.category) return false;
      }
      if (f.priorities && f.priorities.length > 0) {
        const p = (t.priority ?? 'none') as TaskPriority;
        if (!f.priorities.includes(p)) return false;
      }
      if (f.dueWithinDays !== undefined) {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate).getTime();
        const diffDays = Math.ceil((due - now) / (24 * 3600 * 1000));
        if (diffDays > f.dueWithinDays) return false;
      }
      return true;
    });
  }
}
