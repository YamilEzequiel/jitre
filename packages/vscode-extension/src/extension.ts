import * as vscode from 'vscode';
import { JitreClient } from './api/client';
import { SessionStore } from './state/session';
import { WorkspaceBindingStore } from './state/workspace-binding';
import { ProjectsTreeProvider } from './tree/projects';
import { MyTasksTreeProvider } from './tree/my-tasks';
import { WorkspaceTreeProvider } from './tree/workspaces';
import { NotificationsTreeProvider } from './tree/notifications';
import {
  configureCommand,
  loginCommand,
  logoutCommand,
} from './commands/auth';
import { switchWorkspaceCommand } from './commands/workspace';
import {
  addCommentCommand,
  assignTaskCommand,
  changeTaskPriorityCommand,
  changeTaskStatusCommand,
  completeTaskCommand,
  createTaskCommand,
  openTaskCommand,
  openTaskInBrowserCommand,
} from './commands/tasks';
import {
  startTimerCommand,
  stopTimerCommand,
  toggleTimerCommand,
  TimerStatus,
} from './commands/timer';
import { searchTasksCommand } from './commands/search';
import {
  bindFolderToProjectCommand,
  commitWithTaskRefCommand,
  createBranchFromTaskCommand,
  createTaskFromSelectionCommand,
  unbindFolderCommand,
} from './commands/git-workflow';
import {
  clearMyTasksFilterCommand,
  configureMyTasksFilterCommand,
} from './commands/filters';
import {
  copyTaskKeyCommand,
  copyTaskUrlCommand,
  openTaskByKeyCommand,
} from './commands/clipboard';
import {
  generateDescriptionCommand,
  suggestSubtasksCommand,
} from './commands/ai';
import { attachFileToTaskCommand } from './commands/attach';
import { MyTasksFilterStore } from './state/filters';
import { NotificationsStatus } from './state/notifications-status';
import { getGitApi } from './util/git';
import { TaskRefCodeLensProvider } from './codelens/task-refs';
import { JitreRealtime } from './realtime/socket';
import { TaskPanel } from './webview/task-panel';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const client = new JitreClient(context.secrets);
  const session = new SessionStore(client);
  const bindings = new WorkspaceBindingStore();
  await bindings.loadAll();

  const filters = new MyTasksFilterStore(context.globalState);
  const notificationsStatus = new NotificationsStatus(client);
  const codeLens = new TaskRefCodeLensProvider(client);
  const realtime = new JitreRealtime(client);

  const projectsTree = new ProjectsTreeProvider(client, () => onTaskChange());
  const myTasksTree = new MyTasksTreeProvider(client, filters);
  const workspacesTree = new WorkspaceTreeProvider(client, bindings);
  const notificationsTree = new NotificationsTreeProvider(client);

  const refreshAll = (): void => {
    projectsTree.refresh();
    myTasksTree.refresh();
    workspacesTree.refresh();
    notificationsTree.refresh();
    void workspacesTree.refreshActiveTask();
  };

  const timer = new TimerStatus(client);

  const onTaskChange = (): void => {
    projectsTree.refresh();
    myTasksTree.refresh();
    void timer.refresh();
    void workspacesTree.refreshActiveTask();
  };

  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  status.command = 'jitre.switchWorkspace';

  const updateStatus = (): void => {
    if (!client.isSignedIn()) {
      status.text = '$(sign-in) Jitre: sign in';
      status.tooltip = 'Click to sign in to Jitre';
      status.command = 'jitre.login';
    } else {
      const ws = client.getWorkspace();
      const user = client.getUser();
      status.text = ws
        ? `$(rocket) ${ws.name}`
        : `$(rocket) ${user?.displayName ?? 'Jitre'}`;
      status.tooltip = `Jitre · signed in as ${user?.email ?? '—'}\nWorkspace: ${ws?.name ?? 'none'}\nClick to switch workspace.`;
      status.command = 'jitre.switchWorkspace';
    }
    status.show();
  };

  // Wire git branch changes to active-task detection.
  void (async () => {
    const git = await getGitApi();
    if (!git) return;
    const subscribeRepo = (repo: { state: { onDidChange: vscode.Event<void> } }): void => {
      const sub = repo.state.onDidChange(() => {
        void workspacesTree.refreshActiveTask();
      });
      context.subscriptions.push(sub);
    };
    git.repositories.forEach(subscribeRepo);
    context.subscriptions.push(git.onDidOpenRepository(subscribeRepo));
  })();

  realtime.on({
    onTaskChanged: () => {
      projectsTree.refresh();
      myTasksTree.refresh();
      void workspacesTree.refreshActiveTask();
    },
    onProjectChanged: () => {
      projectsTree.refresh();
    },
    onCommentChanged: () => {
      // No-op at the tree level; TaskPanel reloads on refresh button.
    },
    onNotificationCreated: () => {
      notificationsTree.refresh();
      void notificationsStatus.refresh();
    },
  });

  context.subscriptions.push(
    status,
    { dispose: () => timer.dispose() },
    { dispose: () => notificationsStatus.dispose() },
    { dispose: () => realtime.dispose() },
    bindings.onDidChange(() => workspacesTree.refresh()),
    filters.onDidChange(() => myTasksTree.refresh()),
    session.onDidChange(() => {
      updateStatus();
      refreshAll();
      void timer.refresh();
      void notificationsStatus.refresh();
      if (client.isSignedIn()) {
        notificationsStatus.start();
        realtime.connect();
      } else {
        notificationsStatus.stop();
        realtime.disconnect();
      }
      codeLens.refresh();
    }),
    vscode.window.registerTreeDataProvider('jitre.workspaces', workspacesTree),
    vscode.window.createTreeView('jitre.projects', {
      treeDataProvider: projectsTree,
      dragAndDropController: projectsTree,
      canSelectMany: true,
      showCollapseAll: true,
    }),
    vscode.window.registerTreeDataProvider('jitre.myTasks', myTasksTree),
    vscode.window.registerTreeDataProvider('jitre.notifications', notificationsTree),
    vscode.commands.registerCommand('jitre.login', async () => {
      try {
        await loginCommand(client);
      } catch (err) {
        void vscode.window.showErrorMessage(`Sign-in failed: ${(err as Error).message}`);
      }
    }),
    vscode.commands.registerCommand('jitre.logout', () => logoutCommand(client)),
    vscode.commands.registerCommand('jitre.configure', () => configureCommand()),
    vscode.commands.registerCommand('jitre.refresh', () => refreshAll()),
    vscode.commands.registerCommand('jitre.switchWorkspace', () =>
      switchWorkspaceCommand(client),
    ),
    vscode.commands.registerCommand('jitre.openTask', (arg: unknown) =>
      openTaskCommand(context, client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.openTaskInBrowser', (arg: unknown) =>
      openTaskInBrowserCommand(client, arg),
    ),
    vscode.commands.registerCommand('jitre.createTask', (arg: unknown) =>
      createTaskCommand(client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.changeTaskStatus', (arg: unknown) =>
      changeTaskStatusCommand(client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.changeTaskPriority', (arg: unknown) =>
      changeTaskPriorityCommand(client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.assignTask', (arg: unknown) =>
      assignTaskCommand(client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.completeTask', (arg: unknown) =>
      completeTaskCommand(client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.addComment', (arg: unknown) =>
      addCommentCommand(client, arg),
    ),
    vscode.commands.registerCommand('jitre.markAllNotificationsRead', async () => {
      try {
        const res = await client.markAllNotificationsRead();
        notificationsTree.refresh();
        void vscode.window.showInformationMessage(
          `Marked ${res.updated} notification(s) as read.`,
        );
      } catch (err) {
        void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
      }
    }),
    vscode.commands.registerCommand('jitre.startTimer', (arg: unknown) =>
      startTimerCommand(client, timer, arg),
    ),
    vscode.commands.registerCommand('jitre.stopTimer', () =>
      stopTimerCommand(client, timer),
    ),
    vscode.commands.registerCommand('jitre.toggleTimer', () =>
      toggleTimerCommand(client, timer),
    ),
    vscode.commands.registerCommand('jitre.searchTasks', () =>
      searchTasksCommand(client, (project, task) =>
        void TaskPanel.open(context, client, project, task, onTaskChange),
      ),
    ),
    vscode.commands.registerCommand('jitre.bindFolderToProject', () =>
      bindFolderToProjectCommand(client, bindings),
    ),
    vscode.commands.registerCommand('jitre.unbindFolder', () =>
      unbindFolderCommand(bindings),
    ),
    vscode.commands.registerCommand('jitre.createBranchFromTask', (arg: unknown) =>
      createBranchFromTaskCommand(client, bindings, arg),
    ),
    vscode.commands.registerCommand('jitre.commitWithTaskRef', () =>
      commitWithTaskRefCommand(),
    ),
    vscode.commands.registerCommand('jitre.createTaskFromSelection', () =>
      createTaskFromSelectionCommand(client, bindings, onTaskChange),
    ),
    vscode.commands.registerCommand('jitre.configureFilter', () =>
      configureMyTasksFilterCommand(filters),
    ),
    vscode.commands.registerCommand('jitre.clearFilter', () =>
      clearMyTasksFilterCommand(filters),
    ),
    vscode.commands.registerCommand('jitre.copyTaskKey', (arg: unknown) =>
      copyTaskKeyCommand(arg),
    ),
    vscode.commands.registerCommand('jitre.copyTaskUrl', (arg: unknown) =>
      copyTaskUrlCommand(client, arg),
    ),
    vscode.commands.registerCommand('jitre.openTaskByKey', () =>
      openTaskByKeyCommand(client, async (projectId, taskId) => {
        const [project, task] = await Promise.all([
          client.getProject(projectId),
          client.getTask(taskId),
        ]);
        await TaskPanel.open(context, client, project, task, onTaskChange);
      }),
    ),
    vscode.commands.registerCommand('jitre.openNotifications', () =>
      vscode.commands.executeCommand('workbench.view.extension.jitre'),
    ),
    vscode.commands.registerCommand('jitre.suggestSubtasks', (arg: unknown) =>
      suggestSubtasksCommand(client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.generateDescription', (arg: unknown) =>
      generateDescriptionCommand(client, onTaskChange, arg),
    ),
    vscode.commands.registerCommand('jitre.attachFileToTask', (uri: unknown) =>
      attachFileToTaskCommand(client, uri),
    ),
    vscode.commands.registerCommand('jitre.filterProjects', async () => {
      const text = await vscode.window.showInputBox({
        title: 'Filter projects view',
        prompt: 'Substring match against title / key / description',
        value: projectsTree.getFilter(),
        ignoreFocusOut: false,
      });
      if (text === undefined) return;
      projectsTree.setFilter(text);
    }),
    vscode.commands.registerCommand('jitre.clearProjectsFilter', () => {
      projectsTree.setFilter('');
    }),
    vscode.commands.registerCommand(
      'jitre.openTaskByRef',
      async (
        key: string,
        resolved?: { projectId: string; taskId: string; title: string },
      ) => {
        try {
          if (resolved) {
            const [project, task] = await Promise.all([
              client.getProject(resolved.projectId),
              client.getTask(resolved.taskId),
            ]);
            await TaskPanel.open(context, client, project, task, onTaskChange);
            return;
          }
          const res = await client.search(key, 'task', 5);
          const hit = res.items.find((h) => h.snippet?.includes(key)) ?? res.items[0];
          if (!hit) {
            void vscode.window.showInformationMessage(`No task matching ${key}.`);
            return;
          }
          const task = await client.getTask(hit.entityId);
          const project = await client.getProject(task.projectId);
          await TaskPanel.open(context, client, project, task, onTaskChange);
        } catch (err) {
          void vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
        }
      },
    ),
    vscode.languages.registerCodeLensProvider(
      [
        { scheme: 'file' },
        { scheme: 'untitled' },
        { scheme: 'vscode-userdata' },
      ],
      codeLens,
    ),
  );

  await client.hydrate();
  session.syncContext();
  updateStatus();
  refreshAll();
  void timer.refresh();
  if (client.isSignedIn()) {
    notificationsStatus.start();
    realtime.connect();
  }
}

export function deactivate(): void {
  // nothing to clean up — VS Code disposes our subscriptions automatically.
}
