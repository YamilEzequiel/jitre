import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type { NotificationItem } from '../api/types';

type Node = NotificationNode | MessageNode;

class NotificationNode {
  readonly kind = 'notification' as const;
  constructor(public readonly notification: NotificationItem) {}
}

class MessageNode {
  readonly kind = 'message' as const;
  constructor(public readonly label: string) {}
}

export class NotificationsTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly client: JitreClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === 'message') {
      return new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    }
    const n = node.notification;
    const unread = !n.readAt;
    const item = new vscode.TreeItem(
      n.title ?? n.type,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = n.createdAt?.slice(0, 16).replace('T', ' ');
    item.tooltip = n.message ?? n.type;
    item.iconPath = new vscode.ThemeIcon(unread ? 'bell-dot' : 'bell');
    item.contextValue = 'jitre.notification';
    return item;
  }

  async getChildren(): Promise<Node[]> {
    if (!this.client.isSignedIn()) return [];
    try {
      const page = await this.client.listNotifications();
      if (!page.items || page.items.length === 0) {
        return [new MessageNode('No notifications.')];
      }
      return page.items.map((n) => new NotificationNode(n));
    } catch (err) {
      return [new MessageNode(`Error: ${(err as Error).message}`)];
    }
  }
}
