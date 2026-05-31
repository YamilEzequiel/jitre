import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type {
  ProjectStatus,
  ProjectSummary,
  TaskPriority,
  TaskSummary,
} from '../api/types';

type Node = ProjectNode | StatusGroupNode | TaskNode | MessageNode;

export class ProjectNode {
  readonly kind = 'project' as const;
  constructor(public readonly project: ProjectSummary) {}
}

export class StatusGroupNode {
  readonly kind = 'status' as const;
  constructor(
    public readonly project: ProjectSummary,
    public readonly status: ProjectStatus,
    public readonly tasks: TaskSummary[],
  ) {}
}

export class TaskNode {
  readonly kind = 'task' as const;
  constructor(
    public readonly project: ProjectSummary,
    public readonly task: TaskSummary,
    public readonly status?: ProjectStatus,
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

const TASK_DND_MIME = 'application/vnd.jitre.task';

export class ProjectsTreeProvider
  implements vscode.TreeDataProvider<Node>, vscode.TreeDragAndDropController<Node>
{
  readonly dropMimeTypes = [TASK_DND_MIME];
  readonly dragMimeTypes = [TASK_DND_MIME];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projectsCache: ProjectSummary[] | null = null;
  private readonly tasksCache = new Map<string, TaskSummary[]>();
  private readonly statusCache = new Map<string, ProjectStatus[]>();
  private filterText = '';

  constructor(
    private readonly client: JitreClient,
    private readonly onTaskMoved?: () => void,
  ) {}

  setFilter(text: string): void {
    this.filterText = text.trim().toLowerCase();
    this._onDidChangeTreeData.fire();
  }

  getFilter(): string {
    return this.filterText;
  }

  refresh(): void {
    this.projectsCache = null;
    this.tasksCache.clear();
    this.statusCache.clear();
    this._onDidChangeTreeData.fire();
  }

  refreshProject(projectId: string): void {
    this.tasksCache.delete(projectId);
    this.statusCache.delete(projectId);
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    switch (node.kind) {
      case 'project': {
        const item = new vscode.TreeItem(
          node.project.name,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.description = node.project.key;
        item.contextValue = 'jitre.project';
        item.iconPath = new vscode.ThemeIcon('project');
        item.tooltip = node.project.description ?? undefined;
        return item;
      }
      case 'status': {
        const item = new vscode.TreeItem(
          `${node.status.name} · ${node.tasks.length}`,
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.contextValue = 'jitre.status';
        item.iconPath = statusIcon(node.status.category);
        return item;
      }
      case 'task': {
        const item = new vscode.TreeItem(
          node.task.title,
          vscode.TreeItemCollapsibleState.None,
        );
        item.description = formatTaskDescription(node.task);
        item.contextValue = 'jitre.task';
        item.iconPath = new vscode.ThemeIcon(
          PRIORITY_ICON[(node.task.priority ?? 'none') as TaskPriority],
        );
        item.tooltip = buildTaskTooltip(node.task);
        item.command = {
          command: 'jitre.openTask',
          title: 'Open task',
          arguments: [{ project: node.project, task: node.task }],
        };
        return item;
      }
      case 'message': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'jitre.message';
        return item;
      }
    }
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (!this.client.isSignedIn()) return [];

    if (!node) {
      try {
        if (!this.projectsCache) {
          this.projectsCache = await this.client.listProjects();
        }
        if (this.projectsCache.length === 0) {
          return [new MessageNode('No projects in this workspace.')];
        }
        const header: Node[] = this.filterText
          ? [new MessageNode(`Filter: "${this.filterText}" — clear with 'Jitre: Clear filters'.`)]
          : [];
        return [...header, ...this.projectsCache.map((p) => new ProjectNode(p))];
      } catch (err) {
        return [new MessageNode(`Error: ${(err as Error).message}`)];
      }
    }

    if (node.kind === 'project') {
      try {
        const [statuses, allTasks] = await Promise.all([
          this.loadStatuses(node.project.id),
          this.loadTasks(node.project.id),
        ]);
        const tasks = this.applyTextFilter(allTasks);
        if (tasks.length === 0) {
          return [
            new MessageNode(this.filterText ? 'No tasks match the filter.' : 'No tasks yet.'),
          ];
        }
        const grouped = groupByStatus(tasks, statuses);
        return grouped.map(
          ([status, group]) => new StatusGroupNode(node.project, status, group),
        );
      } catch (err) {
        return [new MessageNode(`Error: ${(err as Error).message}`)];
      }
    }

    if (node.kind === 'status') {
      return node.tasks.map(
        (t) => new TaskNode(node.project, t, node.status),
      );
    }

    return [];
  }

  // ─── DnD ──────────────────────────────────────────────────────────────────

  handleDrag(
    source: readonly Node[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): void {
    const tasks = source.filter((n): n is TaskNode => n.kind === 'task');
    if (tasks.length === 0) return;
    dataTransfer.set(
      TASK_DND_MIME,
      new vscode.DataTransferItem(
        tasks.map((t) => ({
          projectId: t.project.id,
          taskId: t.task.id,
        })),
      ),
    );
  }

  async handleDrop(
    target: Node | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const item = dataTransfer.get(TASK_DND_MIME);
    if (!item) return;
    const payload = item.value as Array<{ projectId: string; taskId: string }>;
    if (!payload?.length) return;
    if (!target) return;

    // Resolve target status.
    let targetStatus: ProjectStatus | null = null;
    let targetProject: ProjectSummary | null = null;
    if (target.kind === 'status') {
      targetStatus = target.status;
      targetProject = target.project;
    } else if (target.kind === 'task' && target.status) {
      targetStatus = target.status;
      targetProject = target.project;
    } else if (target.kind === 'project') {
      const statuses = await this.loadStatuses(target.project.id);
      const first = statuses[0];
      if (!first) return;
      targetStatus = first;
      targetProject = target.project;
    }
    if (!targetStatus || !targetProject) return;
    if (targetStatus.id === '__none__') return;

    let moved = 0;
    for (const drag of payload) {
      if (drag.projectId !== targetProject.id) {
        // Cross-project DnD not supported by the API surface used here.
        continue;
      }
      try {
        await this.client.changeTaskStatus(drag.projectId, drag.taskId, targetStatus.id);
        moved++;
      } catch (err) {
        void vscode.window.showWarningMessage(
          `Could not move task: ${(err as Error).message}`,
        );
      }
    }
    if (moved > 0) {
      this.refreshProject(targetProject.id);
      this.onTaskMoved?.();
      void vscode.window.setStatusBarMessage(
        `Moved ${moved} task(s) → ${targetStatus.name}`,
        2500,
      );
    }
  }

  // ─── caches ───────────────────────────────────────────────────────────────

  private applyTextFilter(tasks: TaskSummary[]): TaskSummary[] {
    if (!this.filterText) return tasks;
    return tasks.filter((t) => {
      const hay = `${t.title} ${t.key ?? ''} ${t.description ?? ''}`.toLowerCase();
      return hay.includes(this.filterText);
    });
  }

  private async loadStatuses(projectId: string): Promise<ProjectStatus[]> {
    let cached = this.statusCache.get(projectId);
    if (!cached) {
      cached = await this.client.listProjectStatuses(projectId);
      this.statusCache.set(projectId, cached);
    }
    return cached;
  }

  private async loadTasks(projectId: string): Promise<TaskSummary[]> {
    let cached = this.tasksCache.get(projectId);
    if (!cached) {
      cached = await this.client.listProjectTasks(projectId);
      this.tasksCache.set(projectId, cached);
    }
    return cached;
  }

  async getStatuses(projectId: string): Promise<ProjectStatus[]> {
    return this.loadStatuses(projectId);
  }
}

export function statusIcon(category: string): vscode.ThemeIcon {
  switch (category) {
    case 'in_progress':
      return new vscode.ThemeIcon('sync');
    case 'done':
      return new vscode.ThemeIcon('check-all');
    default:
      return new vscode.ThemeIcon('circle-outline');
  }
}

export function formatTaskDescription(task: TaskSummary): string {
  const bits: string[] = [];
  if (task.key) bits.push(task.key);
  if (task.priority && task.priority !== 'none') bits.push(task.priority);
  if (task.dueDate) bits.push(`due ${task.dueDate.slice(0, 10)}`);
  return bits.join(' · ');
}

function buildTaskTooltip(task: TaskSummary): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.supportHtml = false;
  md.appendMarkdown(`**${task.title}**\n\n`);
  if (task.key) md.appendMarkdown(`\`${task.key}\` · `);
  if (task.priority) md.appendMarkdown(`priority: ${task.priority} · `);
  if (task.type) md.appendMarkdown(`type: ${task.type}`);
  if (task.description) md.appendMarkdown(`\n\n${task.description}`);
  return md;
}

function groupByStatus(
  tasks: TaskSummary[],
  statuses: ProjectStatus[],
): Array<[ProjectStatus, TaskSummary[]]> {
  const byId = new Map<string, TaskSummary[]>();
  const orphans: TaskSummary[] = [];
  for (const t of tasks) {
    if (t.statusId) {
      const arr = byId.get(t.statusId) ?? [];
      arr.push(t);
      byId.set(t.statusId, arr);
    } else {
      orphans.push(t);
    }
  }
  const ordered = [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out: Array<[ProjectStatus, TaskSummary[]]> = [];
  for (const s of ordered) {
    const arr = byId.get(s.id);
    if (arr && arr.length > 0) out.push([s, arr]);
  }
  if (orphans.length > 0) {
    out.push([
      {
        id: '__none__',
        name: 'No status',
        category: 'todo',
      } as ProjectStatus,
      orphans,
    ]);
  }
  return out;
}
