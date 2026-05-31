import * as vscode from 'vscode';
import { JitreClient } from '../api/client';

export class SessionStore {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly client: JitreClient) {
    client.onDidChange(() => {
      this.syncContext();
      this._onDidChange.fire();
    });
  }

  syncContext(): void {
    const signedIn = this.client.isSignedIn();
    void vscode.commands.executeCommand('setContext', 'jitre.signedIn', signedIn);
  }
}
