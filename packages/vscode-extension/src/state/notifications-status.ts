import * as vscode from 'vscode';
import { JitreClient } from '../api/client';

const POLL_MS = 60_000;

export class NotificationsStatus {
  private readonly item: vscode.StatusBarItem;
  private handle: NodeJS.Timeout | null = null;
  private unread = 0;

  constructor(private readonly client: JitreClient) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98,
    );
    this.item.command = 'jitre.openNotifications';
  }

  dispose(): void {
    this.stop();
    this.item.dispose();
  }

  start(): void {
    if (this.handle) return;
    void this.refresh();
    this.handle = setInterval(() => void this.refresh(), POLL_MS);
  }

  stop(): void {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = null;
    }
    this.unread = 0;
    this.item.hide();
  }

  async refresh(): Promise<void> {
    if (!this.client.isSignedIn()) {
      this.stop();
      return;
    }
    try {
      const page = await this.client.listNotifications(true);
      this.unread = page.total ?? page.items?.length ?? 0;
    } catch {
      this.unread = 0;
    }
    this.render();
  }

  private render(): void {
    if (this.unread <= 0) {
      this.item.text = '$(bell)';
      this.item.tooltip = 'Jitre · no unread notifications';
    } else {
      this.item.text = `$(bell-dot) ${this.unread}`;
      this.item.tooltip = `Jitre · ${this.unread} unread notification(s)`;
    }
    this.item.show();
  }
}
