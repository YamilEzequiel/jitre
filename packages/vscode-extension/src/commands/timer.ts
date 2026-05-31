import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type { ActiveTimer, ProjectSummary, TaskSummary } from '../api/types';
import { resolveTaskContext } from './tasks';

export class TimerStatus {
  private readonly item: vscode.StatusBarItem;
  private intervalHandle: NodeJS.Timeout | null = null;
  private current: ActiveTimer | null = null;

  constructor(private readonly client: JitreClient) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99,
    );
    this.item.command = 'jitre.toggleTimer';
  }

  dispose(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.item.dispose();
  }

  async refresh(): Promise<void> {
    if (!this.client.isSignedIn()) {
      this.current = null;
      this.item.hide();
      this.clearInterval();
      return;
    }
    try {
      this.current = await this.client.getActiveTimer();
    } catch {
      this.current = null;
    }
    this.render();
    if (this.current && !this.intervalHandle) {
      this.intervalHandle = setInterval(() => this.render(), 1000);
    } else if (!this.current) {
      this.clearInterval();
    }
  }

  private clearInterval(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private render(): void {
    if (!this.current) {
      this.item.text = '$(watch) Start timer';
      this.item.tooltip = 'Click to start a Jitre timer';
    } else {
      const elapsed = Date.now() - new Date(this.current.startedAt).getTime();
      this.item.text = `$(record) ${formatElapsed(elapsed)}`;
      this.item.tooltip = `Tracking task ${this.current.taskId} — click to stop`;
    }
    this.item.show();
  }

  getCurrent(): ActiveTimer | null {
    return this.current;
  }
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export async function startTimerCommand(
  client: JitreClient,
  timer: TimerStatus,
  arg: unknown,
): Promise<void> {
  const ctx = resolveTaskContext(arg);
  let taskId: string | undefined = ctx?.task.id;
  if (!taskId) {
    const pick = await pickAnyTask(client);
    if (!pick) return;
    taskId = pick.task.id;
  }
  try {
    await client.startTimer(taskId);
    await timer.refresh();
    void vscode.window.showInformationMessage('Timer started.');
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export async function stopTimerCommand(
  client: JitreClient,
  timer: TimerStatus,
): Promise<void> {
  try {
    await client.stopTimer();
    await timer.refresh();
    void vscode.window.showInformationMessage('Timer stopped.');
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
  }
}

export async function toggleTimerCommand(
  client: JitreClient,
  timer: TimerStatus,
): Promise<void> {
  if (timer.getCurrent()) {
    await stopTimerCommand(client, timer);
  } else {
    await startTimerCommand(client, timer, undefined);
  }
}

async function pickAnyTask(
  client: JitreClient,
): Promise<{ project: ProjectSummary; task: TaskSummary } | null> {
  const user = client.getUser();
  if (!user) return null;
  const projects = await client.listProjects();
  const groups = await Promise.all(
    projects.map(async (p) => {
      try {
        const tasks = await client.listProjectTasks(p.id, {
          assigneeUserId: user.id,
        });
        return tasks.map((t) => ({ project: p, task: t }));
      } catch {
        return [];
      }
    }),
  );
  const flat = groups.flat();
  if (flat.length === 0) {
    void vscode.window.showInformationMessage('No assigned tasks to track.');
    return null;
  }
  const pick = await vscode.window.showQuickPick(
    flat.map((g) => ({
      label: g.task.title,
      description: `${g.project.key} · ${g.task.key ?? ''}`,
      detail: g.task.description?.slice(0, 100),
      ctx: g,
    })),
    { title: 'Start timer', placeHolder: 'Pick a task to track' },
  );
  return pick?.ctx ?? null;
}
