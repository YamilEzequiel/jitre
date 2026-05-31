import * as vscode from 'vscode';
import { JitreClient } from '../api/client';

export async function loginCommand(client: JitreClient): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('jitre');
  const currentUrl = cfg.get<string>('apiUrl') ?? 'http://localhost:3000';
  const apiUrl = await vscode.window.showInputBox({
    title: 'Jitre · Sign in',
    prompt: 'Backend URL',
    value: currentUrl,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? null : 'Required.'),
  });
  if (!apiUrl) return;
  await cfg.update('apiUrl', apiUrl.trim(), vscode.ConfigurationTarget.Global);

  const email = await vscode.window.showInputBox({
    title: 'Jitre · Sign in',
    prompt: 'Email',
    placeHolder: 'you@example.com',
    ignoreFocusOut: true,
    validateInput: (v) => (v.includes('@') ? null : 'Enter a valid email.'),
  });
  if (!email) return;

  const password = await vscode.window.showInputBox({
    title: 'Jitre · Sign in',
    prompt: 'Password',
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.length >= 1 ? null : 'Required.'),
  });
  if (!password) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Signing in to Jitre…' },
    async () => {
      await client.login(email.trim(), password);
    },
  );

  const user = client.getUser();
  const ws = client.getWorkspace();
  if (user && ws) {
    void vscode.window.showInformationMessage(
      `Signed in as ${user.displayName} (${ws.name}).`,
    );
  }
}

export async function logoutCommand(client: JitreClient): Promise<void> {
  await client.logout();
  void vscode.window.showInformationMessage('Signed out of Jitre.');
}

export async function configureCommand(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openSettings',
    'jitre',
  );
}
