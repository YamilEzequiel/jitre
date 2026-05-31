import * as vscode from 'vscode';
import type { StatusCategory, TaskPriority } from '../api/types';

export interface MyTasksFilter {
  category?: StatusCategory;
  priorities?: TaskPriority[];
  dueWithinDays?: number;
}

const STORAGE_KEY = 'jitre.myTasksFilter';

export class MyTasksFilterStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private state: MyTasksFilter;

  constructor(private readonly memento: vscode.Memento) {
    this.state = memento.get<MyTasksFilter>(STORAGE_KEY, {});
  }

  get(): MyTasksFilter {
    return this.state;
  }

  async update(patch: MyTasksFilter): Promise<void> {
    this.state = { ...this.state, ...patch };
    await this.memento.update(STORAGE_KEY, this.state);
    this._onDidChange.fire();
  }

  async reset(): Promise<void> {
    this.state = {};
    await this.memento.update(STORAGE_KEY, this.state);
    this._onDidChange.fire();
  }

  isActive(): boolean {
    return !!(
      this.state.category ||
      (this.state.priorities && this.state.priorities.length > 0) ||
      this.state.dueWithinDays
    );
  }

  describe(): string {
    const parts: string[] = [];
    if (this.state.category) parts.push(this.state.category);
    if (this.state.priorities?.length) parts.push(this.state.priorities.join('|'));
    if (this.state.dueWithinDays) parts.push(`≤ ${this.state.dueWithinDays}d`);
    return parts.length ? parts.join(' · ') : 'all';
  }
}
