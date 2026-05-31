import * as vscode from 'vscode';
import { JitreClient } from '../api/client';
import type {
  Comment,
  ProjectStatus,
  ProjectSummary,
  TaskPriority,
  TaskSummary,
} from '../api/types';

const PRIORITIES: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent'];

interface OpenMessage {
  task: TaskSummary;
  statuses: ProjectStatus[];
  comments: Comment[];
}

export class TaskPanel {
  private static readonly panels = new Map<string, TaskPanel>();

  static async open(
    context: vscode.ExtensionContext,
    client: JitreClient,
    project: ProjectSummary,
    task: TaskSummary,
    onTaskChange: () => void,
  ): Promise<void> {
    const key = `${project.id}:${task.id}`;
    const existing = TaskPanel.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Active);
      await existing.reload();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'jitre.taskDetail',
      task.key ? `${task.key} · ${task.title}` : task.title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
    const instance = new TaskPanel(panel, context, client, project, task, onTaskChange);
    TaskPanel.panels.set(key, instance);
    panel.onDidDispose(() => TaskPanel.panels.delete(key));
    await instance.reload();
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly client: JitreClient,
    private readonly project: ProjectSummary,
    private task: TaskSummary,
    private readonly onTaskChange: () => void,
  ) {
    this.panel.webview.html = this.renderShell();
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
  }

  private async reload(): Promise<void> {
    try {
      const [statuses, commentsPage, fresh] = await Promise.all([
        this.client.listProjectStatuses(this.project.id),
        this.client.listComments(this.task.id),
        this.client.getTask(this.task.id).catch(() => this.task),
      ]);
      this.task = fresh;
      const payload: OpenMessage = {
        task: this.task,
        statuses,
        comments: commentsPage.data ?? [],
      };
      this.panel.webview.postMessage({ type: 'data', payload });
    } catch (err) {
      this.panel.webview.postMessage({
        type: 'error',
        message: (err as Error).message,
      });
    }
  }

  private async handleMessage(msg: unknown): Promise<void> {
    if (!msg || typeof msg !== 'object') return;
    const action = (msg as { type?: string }).type;
    try {
      switch (action) {
        case 'ready':
          await this.reload();
          return;
        case 'change-status': {
          const { statusId } = msg as { statusId: string };
          await this.client.changeTaskStatus(this.project.id, this.task.id, statusId);
          this.onTaskChange();
          await this.reload();
          return;
        }
        case 'change-priority': {
          const { priority } = msg as { priority: TaskPriority };
          await this.client.updateTask(this.project.id, this.task.id, { priority });
          this.onTaskChange();
          await this.reload();
          return;
        }
        case 'complete': {
          await this.client.completeTask(this.project.id, this.task.id);
          this.onTaskChange();
          await this.reload();
          return;
        }
        case 'add-comment': {
          const { body } = msg as { body: string };
          if (!body?.trim()) return;
          await this.client.addComment(this.task.id, body.trim());
          await this.reload();
          return;
        }
        case 'refresh':
          await this.reload();
          return;
        case 'open-browser': {
          const web = this.client.webBaseUrl();
          void vscode.env.openExternal(
            vscode.Uri.parse(`${web}/tasks/${this.task.id}?projectId=${this.project.id}`),
          );
          return;
        }
      }
    } catch (err) {
      this.panel.webview.postMessage({
        type: 'error',
        message: (err as Error).message,
      });
    }
  }

  private renderShell(): string {
    const cspSource = this.panel.webview.cspSource;
    const prioritiesJson = JSON.stringify(PRIORITIES);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: https:;" />
<title>Jitre task</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px 24px;
    line-height: 1.5;
  }
  h1 { font-size: 1.4em; margin: 0 0 4px; }
  .meta {
    display: flex; flex-wrap: wrap; gap: 8px 16px;
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em; margin-bottom: 16px;
  }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  label { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
  select, textarea, input, button {
    font-family: inherit; font-size: inherit;
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px; padding: 4px 8px;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; cursor: pointer; padding: 6px 12px;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .description {
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
    border-radius: 6px;
    padding: 12px;
    white-space: pre-wrap;
    background: var(--vscode-textBlockQuote-background);
    margin-bottom: 16px;
  }
  .comment {
    border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
    padding: 10px 0;
  }
  .comment-meta { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
  .source-badge {
    display: inline-block;
    padding: 1px 6px;
    margin-left: 4px;
    border-radius: 4px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  textarea { width: 100%; min-height: 80px; box-sizing: border-box; }
  .status-pill {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
    font-size: 0.8em;
  }
  .err { color: var(--vscode-errorForeground); margin-top: 8px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
</style>
</head>
<body>
<header>
  <h1 id="title">Loading…</h1>
  <div class="meta" id="meta"></div>
  <div class="toolbar">
    <button id="btn-complete">Mark done</button>
    <button id="btn-refresh" class="secondary">Refresh</button>
    <button id="btn-browser" class="secondary">Open in browser</button>
  </div>
</header>
<section class="row">
  <label for="status">Status</label>
  <select id="status"></select>
  <label for="priority">Priority</label>
  <select id="priority"></select>
</section>
<section>
  <h3>Description</h3>
  <div class="description" id="description">—</div>
</section>
<section>
  <h3>Comments</h3>
  <div id="comments"></div>
  <textarea id="new-comment" placeholder="Write a comment…"></textarea>
  <div style="display:flex;justify-content:flex-end;margin-top:6px;">
    <button id="btn-comment">Post comment</button>
  </div>
</section>
<p class="err" id="err"></p>
<script>
  const vscode = acquireVsCodeApi();
  const PRIORITIES = ${prioritiesJson};

  const $ = (id) => document.getElementById(id);

  function fmtDate(s) {
    if (!s) return '';
    try { return new Date(s).toLocaleString(); } catch { return s; }
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function render(task, statuses, comments) {
    $('err').textContent = '';
    $('title').textContent = (task.key ? task.key + ' · ' : '') + task.title;

    const meta = [];
    if (task.type) meta.push('type: ' + task.type);
    if (task.dueDate) meta.push('due: ' + task.dueDate.slice(0, 10));
    if (task.estimatedHours) meta.push('estimated: ' + task.estimatedHours + 'h');
    if (task.updatedAt) meta.push('updated: ' + fmtDate(task.updatedAt));
    $('meta').innerHTML = meta.map(m => '<span>' + escapeHtml(m) + '</span>').join('');

    $('description').textContent = task.description?.trim() || '—';

    const statusEl = $('status');
    statusEl.innerHTML = statuses
      .sort((a,b) => (a.order||0)-(b.order||0))
      .map(s => '<option value="' + s.id + '"' + (s.id===task.statusId?' selected':'') + '>' + escapeHtml(s.name) + ' (' + s.category + ')</option>')
      .join('');

    const priorityEl = $('priority');
    priorityEl.innerHTML = PRIORITIES.map(p =>
      '<option value="' + p + '"' + (p===(task.priority||'none')?' selected':'') + '>' + p + '</option>'
    ).join('');

    const commentsEl = $('comments');
    if (!comments || comments.length === 0) {
      commentsEl.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">No comments yet.</p>';
    } else {
      commentsEl.innerHTML = comments
        .filter(c => !c.deletedAt)
        .map(c => {
          const author = c.author?.displayName || c.author?.email || c.authorUserId || 'unknown';
          const sourceLabel = sourceBadge(c.source);
          const badgeHtml = sourceLabel
            ? ' <span class="source-badge">via ' + escapeHtml(sourceLabel) + '</span>'
            : '';
          return '<div class="comment"><div class="comment-meta">' +
            escapeHtml(author) + badgeHtml + ' · ' + fmtDate(c.createdAt) +
            '</div><div>' + escapeHtml(c.body).replace(/\\n/g,'<br>') + '</div></div>';
        }).join('');
    }
  }

  function sourceBadge(source) {
    switch (source) {
      case 'extension': return 'VS Code';
      case 'mcp': return 'MCP';
      case 'api': return 'API';
      default: return null;
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'data') {
      render(msg.payload.task, msg.payload.statuses, msg.payload.comments);
    } else if (msg.type === 'error') {
      $('err').textContent = msg.message;
    }
  });

  $('status').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'change-status', statusId: e.target.value });
  });
  $('priority').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'change-priority', priority: e.target.value });
  });
  $('btn-complete').addEventListener('click', () => vscode.postMessage({ type: 'complete' }));
  $('btn-refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  $('btn-browser').addEventListener('click', () => vscode.postMessage({ type: 'open-browser' }));
  $('btn-comment').addEventListener('click', () => {
    const body = $('new-comment').value;
    if (!body.trim()) return;
    vscode.postMessage({ type: 'add-comment', body });
    $('new-comment').value = '';
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}
