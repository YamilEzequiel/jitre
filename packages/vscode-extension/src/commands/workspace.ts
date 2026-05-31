import * as vscode from 'vscode';
import { JitreClient } from '../api/client';

export async function switchWorkspaceCommand(client: JitreClient): Promise<void> {
  if (!client.isSignedIn()) {
    void vscode.window.showWarningMessage('Sign in first.');
    return;
  }
  try {
    const workspaces = await client.listWorkspaces();
    if (!workspaces.length) {
      void vscode.window.showInformationMessage('No workspaces available.');
      return;
    }
    const current = client.getWorkspace();
    const pick = await vscode.window.showQuickPick(
      workspaces.map((w) => ({
        label: w.name,
        description: w.slug + (w.id === current?.id ? '  (current)' : ''),
        detail: w.id,
        workspace: w,
      })),
      { title: 'Switch workspace', placeHolder: 'Pick a workspace' },
    );
    if (!pick) return;
    client.setWorkspace({
      id: pick.workspace.id,
      name: pick.workspace.name,
      slug: pick.workspace.slug,
      role: (pick.workspace.role ?? 'member') as 'owner' | 'admin' | 'member',
    });
    void vscode.window.showInformationMessage(`Switched to ${pick.workspace.name}.`);
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed to list workspaces: ${(err as Error).message}`);
  }
}
