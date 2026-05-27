import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TaskStore } from '../../../stores/task.store';
import { TaskApiService, Task, TaskPriority, TaskType } from '../../../stores/task-api.service';
import { WorkflowStatusStore } from '../../../stores/workflow-status.store';
import { ProjectMemberStore } from '../../../stores/project-member.store';
import { WorkspaceMemberStore } from '../../../stores/workspace-member.store';
import { CommentApiService, CommentDto } from '../../../stores/comment-api.service';
import { OptimisticUpdateService } from '../../../core/optimistic/optimistic-update.service';
import { AiService } from '../../../core/ai/ai.service';
import { ToastService } from '../../../core/toast/toast.service';
import { SkeletonComponent } from '../../../shared/skeleton/skeleton.component';
import { MarkdownPipe } from '../../../shared/markdown/markdown.pipe';
import { TimeLoggerComponent } from '../../time-tracking/time-logger.component';
import { AttachmentListComponent } from '../attachments/attachment-list.component';
import {
  MentionCandidate,
  MentionInputComponent,
} from '../../../shared/mention-input/mention-input.component';

interface DisplayComment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

@Component({
  selector: 'jt-task-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    SelectModule,
    SkeletonComponent,
    MarkdownPipe,
    RouterLink,
    TimeLoggerComponent,
    AttachmentListComponent,
    MentionInputComponent,
  ],
  template: `
    <div class="flex flex-col h-full w-full overflow-auto">
      @if (!task()) {
        <jt-skeleton variant="card" />
      } @else {
        <!-- Title -->
        <header class="space-y-3 mb-6">
          @if (parentTask(); as parent) {
            <a
              [routerLink]="['/tasks', parent.id]"
              [queryParams]="{ projectId: parent.projectId }"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
            >
              <span aria-hidden="true">↑</span> Parent: {{ parent.title }}
            </a>
          }
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                   border border-blue-200 bg-blue-50 backdrop-blur-sm"
          >
            <span
              class="text-[10px] font-bold uppercase tracking-[0.18em]
                     bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300
                     bg-clip-text text-transparent"
            >
              Task
            </span>
          </div>
          @if (editing()) {
            <div class="flex gap-2 items-start">
              <input
                type="text"
                [formControl]="titleControl"
                class="flex-1 text-3xl font-black tracking-tight bg-transparent
                       border-b-2 border-blue-400 outline-none text-slate-950
                       focus:ring-0"
                (keydown.enter)="saveTitle()"
                (keydown.escape)="cancelEdit()"
                aria-label="Edit task title"
              />
              <button
                type="button"
                (click)="saveTitle()"
                class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white
                       bg-gradient-to-r from-indigo-600 to-violet-600
                       shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/40
                       transition-shadow"
              >
                Save
              </button>
              <button
                type="button"
                (click)="cancelEdit()"
                class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700
                       bg-white border border-slate-200 backdrop-blur-sm
                       hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          } @else {
            <h1
              class="text-3xl sm:text-4xl font-black tracking-tight cursor-pointer group inline-flex items-center gap-2"
              (click)="enterEdit()"
              role="button"
              tabindex="0"
              (keydown.enter)="enterEdit()"
              aria-label="Click to edit title"
            >
              <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
                {{ task()!.title }}
              </span>
              <svg
                class="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </h1>
          }
        </header>

        <!-- AI actions (status changer moves to UI phase with dynamic statuses) -->
        <div class="mb-8 flex flex-wrap items-center gap-3">
          <span
            class="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 bg-white border border-slate-200"
          >
            Status: {{ task()!.statusId.slice(0, 6) }}
          </span>

          <label class="inline-flex items-center gap-2" data-testid="task-type-selector">
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Type</span>
            <p-select
              [options]="typeSelectOptions"
              [ngModel]="task()!.type"
              (ngModelChange)="changeType($event)"
              optionLabel="label"
              optionValue="value"
              size="small"
              appendTo="body"
              styleClass="capitalize"
              aria-label="Change task type"
            />
          </label>

          <button
            type="button"
            (click)="aiDescribe()"
            [disabled]="aiDescribeLoading()"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white
                   bg-gradient-to-r from-fuchsia-600 to-violet-600
                   shadow-md shadow-fuchsia-500/25
                   hover:shadow-lg hover:shadow-fuchsia-500/40
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60
                   focus-visible:ring-offset-2 focus-visible:ring-offset-white
                   transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              class="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            @if (aiDescribeLoading()) { Describing… } @else { AI Describe }
          </button>
        </div>

        <section class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Prioridad</p>
            <p class="mt-1 text-sm font-black capitalize text-slate-950">{{ task()!.priority }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Planning</p>
            <p class="mt-1 text-sm font-black text-slate-950">
              {{ task()!.startDate || 'Sin inicio' }} → {{ task()!.dueDate || 'Sin vencimiento' }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Estimación</p>
            <p class="mt-1 text-sm font-black text-slate-950">{{ task()!.estimatedHours ?? 0 }} h</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Equipo</p>
            <p class="mt-1 text-sm font-black text-slate-950">
              {{ task()!.assigneeUserIds?.length ?? 0 }} responsables · {{ task()!.labelIds?.length ?? 0 }} labels
            </p>
          </div>
        </section>

        <!-- Time tracking -->
        <div class="mb-6">
          <jt-time-logger [taskId]="task()!.id" />
        </div>

        <!-- Attachments -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-6 mb-6
                 shadow-lg shadow-slate-200/80"
        >
          <jt-attachment-list context="task" [contextId]="task()!.id" />
        </section>

        <!-- Subtasks -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-6 mb-6
                 shadow-lg shadow-slate-200/80"
        >
          <h2 class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-4">
            Subtasks
          </h2>

          @if (subtasks().length > 0) {
            <ul class="space-y-2 mb-4">
              @for (sub of subtasks(); track sub.id) {
                <li class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    [checked]="isSubtaskDone(sub)"
                    (change)="toggleSubtaskDone(sub)"
                    class="h-4 w-4 rounded border-slate-300 bg-white text-indigo-500 focus:ring-indigo-500/40 focus:ring-offset-0 cursor-pointer"
                    [attr.aria-label]="'Toggle done for ' + sub.title"
                  />
                  <a
                    [routerLink]="['/tasks', sub.id]"
                    [queryParams]="{ projectId: sub.projectId }"
                    [class]="
                      'flex-1 text-sm font-semibold truncate ' +
                      (isSubtaskDone(sub) ? 'text-slate-400 line-through' : 'text-slate-900 hover:text-blue-700')
                    "
                  >
                    {{ sub.title }}
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-slate-500 mb-4">No subtasks yet.</p>
          }

          @if (canCreateSubtasks()) {
            <div class="flex gap-2">
              <input
                type="text"
                [formControl]="subtaskTitleControl"
                placeholder="Add subtask…"
                aria-label="New subtask title"
                class="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition
                       focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
                (keydown.enter)="addSubtask()"
              />
              <button
                type="button"
                [disabled]="!subtaskTitleControl.value?.trim() || addingSubtask()"
                (click)="addSubtask()"
                class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white
                       bg-gradient-to-r from-indigo-600 to-violet-600
                       shadow-md shadow-indigo-500/25
                       hover:shadow-lg hover:shadow-indigo-500/40
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                       focus-visible:ring-offset-2 focus-visible:ring-offset-white
                       transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add subtask
              </button>
            </div>
          } @else {
            <p class="text-xs text-slate-400 italic">
              Subtasks of subtasks aren't supported — task hierarchy is limited to two levels.
            </p>
          }
        </section>

        <!-- Comments -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-6
                 shadow-lg shadow-slate-200/80"
        >
          <h2
            class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-4"
          >
            Comments
          </h2>
          @if (commentsLoading()) {
            <jt-skeleton variant="text" />
          } @else {
            <div class="space-y-3 mb-4">
              @for (comment of comments(); track comment.id) {
                <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        [style.background]="avatarColor(comment.authorId)"
                      >{{ initialsOf(comment.authorName) }}</span>
                      <span class="text-xs font-semibold text-slate-700">{{ comment.authorName }}</span>
                    </div>
                    <span class="text-[11px] text-slate-400">{{ formatDate(comment.createdAt) }}</span>
                  </div>
                  <div
                    class="text-sm text-slate-700 prose prose-sm prose-slate max-w-none"
                    [innerHTML]="renderMentions(comment.body) | markdown"
                  ></div>
                </div>
              } @empty {
                <p class="text-sm text-slate-500">No comments yet. Be the first to say something.</p>
              }
            </div>

            <!-- Comment composer with @mention autocomplete -->
            <div class="space-y-3">
              <jt-mention-input
                [value]="commentDraft()"
                [candidates]="mentionCandidates()"
                [rows]="3"
                placeholder="Write a comment… type @ to mention"
                ariaLabel="New comment"
                (valueChange)="commentDraft.set($event)"
                (submit)="submitComment()"
              />
              <div class="flex items-center justify-between gap-3">
                <p class="text-[11px] text-slate-400">
                  Tip: <kbd class="rounded border border-slate-300 px-1 py-0.5 text-[10px]">@</kbd>
                  to mention &middot;
                  <kbd class="rounded border border-slate-300 px-1 py-0.5 text-[10px]">Ctrl</kbd>+<kbd class="rounded border border-slate-300 px-1 py-0.5 text-[10px]">Enter</kbd>
                  to submit
                </p>
                <button
                  type="button"
                  (click)="submitComment()"
                  [disabled]="!commentDraft().trim() || submittingComment()"
                  class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white
                         bg-gradient-to-r from-indigo-600 to-violet-600
                         shadow-md shadow-indigo-500/25
                         hover:shadow-lg hover:shadow-indigo-500/40
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                         transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ submittingComment() ? 'Posting…' : 'Comment' }}
                </button>
              </div>
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class TaskDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly taskStore = inject(TaskStore);
  private readonly taskApi = inject(TaskApiService);
  private readonly statusStore = inject(WorkflowStatusStore, { optional: true });
  private readonly memberStore = inject(ProjectMemberStore);
  private readonly workspaceMemberStore = inject(WorkspaceMemberStore, { optional: true });
  private readonly commentApi = inject(CommentApiService);
  private readonly optimistic = inject(OptimisticUpdateService);
  private readonly ai = inject(AiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  private taskId = '';

  readonly editing = signal(false);
  readonly commentsLoading = signal(false);
  readonly comments = signal<DisplayComment[]>([]);
  readonly addingSubtask = signal(false);
  readonly savingMetadata = signal(false);

  readonly commentDraft = signal('');
  readonly submittingComment = signal(false);

  readonly mentionCandidates = computed<MentionCandidate[]>(() => {
    const t = this.task();
    if (!t) return [];
    return this.memberStore.byProject(t.projectId)().map(m => ({
      userId: m.userId,
      displayName: m.displayName ?? m.email ?? m.userId,
      email: m.email,
    }));
  });

  readonly titleControl = this.fb.control('');
  readonly subtaskTitleControl = this.fb.control('');
  readonly metadataForm = this.fb.group({
    statusId: [''],
    priority: this.fb.nonNullable.control<TaskPriority>('none'),
    type: this.fb.nonNullable.control<TaskType>('task'),
    startDate: [''],
    dueDate: [''],
    estimatedHours: this.fb.control<number | null>(null),
  });

  readonly task = computed<Task | null>(() => {
    return (this.taskStore.byId() as Record<string, Task>)[this.taskId] ?? null;
  });

  readonly parentTask = computed<Task | null>(() => {
    const t = this.task();
    if (!t?.parentTaskId) return null;
    return (this.taskStore.byId() as Record<string, Task>)[t.parentTaskId] ?? null;
  });

  readonly subtasks = computed<Task[]>(() => {
    const t = this.task();
    if (!t) return [];
    if (t.subtasks && t.subtasks.length > 0) return t.subtasks;
    const all = Object.values(this.taskStore.byId() as Record<string, Task>);
    return all.filter(x => x.parentTaskId === t.id);
  });

  readonly canCreateSubtasks = computed(() => {
    const t = this.task();
    return !!t && !t.parentTaskId;
  });

  readonly aiDescribeLoading = computed(() => this.ai.loading.describe());

  readonly typeOptions: TaskType[] = ['task', 'bug', 'incident', 'feature'];
  readonly typeSelectOptions = this.typeOptions.map(t => ({ label: t, value: t }));
  readonly priorityOptions: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent'];
  readonly statusOptions = computed(() => this.statusStore?.byProject(this.task()?.projectId ?? '')() ?? []);

  ngOnInit(): void {
    this.taskId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.initializeTask();
  }

  private async initializeTask(): Promise<void> {
    let task = this.task();
    const hintedProjectId = this.route.snapshot.queryParamMap.get('projectId') ?? undefined;

    if (!task) {
      try {
        task = await this.taskApi.getById(this.taskId, hintedProjectId);
        this.taskStore.upsert(task);
      } catch {
        this.toast.error('No pudimos abrir la tarea');
        return;
      }
    }

    this.titleControl.setValue(task.title);
    this.syncMetadataForm(task);
    await this.loadComments();
  }

  private syncMetadataForm(task: Task): void {
    this.metadataForm.patchValue({
      statusId: task.statusId,
      priority: task.priority,
      type: task.type,
      startDate: task.startDate ? task.startDate.slice(0, 10) : '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      estimatedHours: task.estimatedHours ?? null,
    }, { emitEvent: false });
  }

  async saveMetadata(): Promise<void> {
    const original = this.task();
    if (!original) return;
    const value = this.metadataForm.getRawValue();
    this.savingMetadata.set(true);
    try {
      if (value.statusId && value.statusId !== original.statusId) {
        await this.changeStatus(value.statusId);
      }
      const updated = await this.taskApi.update(original.projectId, original.id, {
        priority: value.priority,
        type: value.type,
        startDate: value.startDate || null,
        dueDate: value.dueDate || null,
        estimatedHours: value.estimatedHours,
      });
      this.taskStore.upsert(updated);
      this.toast.success('Task updated');
    } catch {
      this.toast.error('Failed to update task');
    } finally {
      this.savingMetadata.set(false);
    }
  }

  enterEdit(): void {
    this.titleControl.setValue(this.task()?.title ?? '');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  async saveTitle(): Promise<void> {
    const newTitle = this.titleControl.value ?? '';
    if (!newTitle.trim() || !this.task()) return;
    const original = this.task()!;

    await this.optimistic.run({
      id: original.id,
      apply: () => {
        this.taskStore.upsert({ ...original, title: newTitle });
        return () => this.taskStore.upsert(original);
      },
      apiCall: () => this.taskApi.update(original.projectId, original.id, { title: newTitle }),
    });
    this.editing.set(false);
  }

  async changeType(type: TaskType): Promise<void> {
    const original = this.task();
    if (!original || original.type === type) return;

    await this.optimistic.run({
      id: original.id,
      apply: () => {
        this.taskStore.upsert({ ...original, type });
        return () => this.taskStore.upsert(original);
      },
      apiCall: () => this.taskApi.update(original.projectId, original.id, { type }),
    });
  }

  async changeStatus(statusId: string): Promise<void> {
    const original = this.task();
    if (!original) return;

    await this.optimistic.run({
      id: original.id,
      apply: () => {
        this.taskStore.upsert({ ...original, statusId });
        return () => this.taskStore.upsert(original);
      },
      apiCall: () => this.taskApi.changeStatus(original.projectId, original.id, statusId),
    });
  }

  async aiDescribe(): Promise<void> {
    const t = this.task();
    if (!t) return;
    try {
      await this.ai.describeTask(t.id);
    } catch {
      this.toast.error('AI describe failed');
    }
  }

  async loadComments(): Promise<void> {
    const t = this.task();
    if (!t) {
      this.commentsLoading.set(false);
      return;
    }
    this.commentsLoading.set(true);
    try {
      // Ensure project members are loaded so we can resolve author names.
      await this.memberStore.loadForProject(t.projectId).catch(() => undefined);
      const raw = await this.commentApi.list({ contextType: 'task', contextId: t.id });
      this.comments.set(raw.map(c => this.toDisplayComment(c)));
    } catch {
      this.comments.set([]);
    } finally {
      this.commentsLoading.set(false);
    }
  }

  private toDisplayComment(c: CommentDto): DisplayComment {
    const t = this.task();
    const members = t ? this.memberStore.byProject(t.projectId)() : [];
    const author = members.find(m => m.userId === c.authorUserId);
    const workspace = this.workspaceMemberStore?.memberFor(c.authorUserId);
    return {
      id: c.id,
      body: c.body,
      authorId: c.authorUserId,
      authorName:
        author?.displayName ??
        author?.email ??
        workspace?.displayName ??
        workspace?.email ??
        'User',
      createdAt: c.createdAt,
    };
  }

  /** Convert `@[name](uuid)` tokens to inline styled mention spans. */
  renderMentions(body: string): string {
    return body.replace(/@\[([^\]]+)\]\(([0-9a-f-]+)\)/gi, (_m, name) => {
      const escaped = String(name).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      } as Record<string, string>)[ch]!);
      return `<span class="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[12px] font-semibold text-indigo-700">@${escaped}</span>`;
    });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  initialsOf(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  avatarColor(userId: string): string {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360}, 65%, 45%)`;
  }

  isSubtaskDone(sub: Task): boolean {
    if (sub.completedAt) return true;
    const byId = (this.statusStore?.byId() ?? {}) as Record<string, { category?: string }>;
    return byId[sub.statusId]?.category === 'done';
  }

  async toggleSubtaskDone(sub: Task): Promise<void> {
    const isDone = this.isSubtaskDone(sub);
    const byId = (this.statusStore?.byId() ?? {}) as Record<string, { category?: string }>;
    const allStatuses = this.statusStore?.byProject(sub.projectId)() ?? [];
    const target = isDone
      ? allStatuses.find(s => byId[s.id]?.category === 'todo' || s.category === 'todo')
      : allStatuses.find(s => byId[s.id]?.category === 'done' || s.category === 'done');
    if (!target) return;
    await this.optimistic.run({
      id: sub.id,
      apply: () => {
        this.taskStore.upsert({ ...sub, statusId: target.id });
        return () => this.taskStore.upsert(sub);
      },
      apiCall: () => this.taskApi.changeStatus(sub.projectId, sub.id, target.id),
    });
  }

  async addSubtask(): Promise<void> {
    const title = this.subtaskTitleControl.value?.trim();
    const parent = this.task();
    if (!title || !parent || !this.canCreateSubtasks()) return;
    const statuses = this.statusStore?.byProject(parent.projectId)() ?? [];
    const defaultStatus = statuses.find(s => s.isDefault) ?? statuses[0];
    if (!defaultStatus) {
      this.toast.error('No workflow status available to assign subtask.');
      return;
    }
    this.addingSubtask.set(true);
    try {
      const created = await this.taskApi.create(parent.projectId, {
        title,
        statusId: defaultStatus.id,
        parentTaskId: parent.id,
      });
      this.taskStore.upsert(created);
      this.subtaskTitleControl.reset();
      this.toast.success('Subtask added');
    } catch {
      this.toast.error('Failed to create subtask');
    } finally {
      this.addingSubtask.set(false);
    }
  }

  async submitComment(): Promise<void> {
    const body = this.commentDraft().trim();
    const t = this.task();
    if (!body || !t || this.submittingComment()) return;
    this.submittingComment.set(true);
    try {
      const created = await this.commentApi.create({
        contextType: 'task',
        contextId: t.id,
        body,
      });
      this.comments.update(cs => [...cs, this.toDisplayComment(created)]);
      this.commentDraft.set('');
      this.toast.success('Comment posted');
    } catch {
      this.toast.error('Failed to add comment');
    } finally {
      this.submittingComment.set(false);
    }
  }
}
