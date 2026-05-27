import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TimeEntryStore } from '../../stores/time-entry.store';
import { TimeEntry } from '../../stores/time-entry-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';
import { parseDurationToMinutes, formatMinutes } from './duration.util';

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Component({
  selector: 'jt-time-logger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section
      [class]="
        compact()
          ? 'rounded-xl border border-slate-200 bg-white p-3'
          : 'rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/80'
      "
      aria-label="Time tracking"
    >
      <header class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <span class="pi pi-clock text-violet-600" aria-hidden="true"></span>
          <span
            class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
          >
            Time
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                   border border-violet-200 bg-violet-50 text-violet-700
                   text-xs font-semibold"
            data-testid="time-total"
          >
            Logged: {{ totalLabel() }}
          </span>
          @if (isActiveTimerForThisTask()) {
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                     border border-emerald-200 bg-emerald-50 text-emerald-700
                     text-xs font-semibold"
            >
              <span
                class="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse"
                aria-hidden="true"
              ></span>
              Timer running
            </span>
          }
        </div>
      </header>

      @if (!compact()) {
        <!-- Timer controls -->
        <div class="flex flex-wrap items-center gap-2 mb-4">
          @if (isActiveTimerForThisTask()) {
            <button
              type="button"
              (click)="onStop()"
              [disabled]="busyTimer()"
              class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold text-white
                     bg-gradient-to-r from-rose-600 to-fuchsia-600
                     shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/40
                     transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span class="pi pi-stop-circle" aria-hidden="true"></span>
              Stop timer
            </button>
          } @else {
            <button
              type="button"
              (click)="onStart()"
              [disabled]="busyTimer()"
              class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold text-white
                     bg-gradient-to-r from-emerald-600 to-teal-600
                     shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/40
                     transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span class="pi pi-play-circle" aria-hidden="true"></span>
              Start timer
            </button>
          }
          @if (otherTaskTimer(); as other) {
            <p
              class="text-[11px] text-amber-700 italic"
              role="status"
              data-testid="other-task-warning"
            >
              Active timer on another task — starting here will auto-stop it.
            </p>
          }
        </div>

        <!-- Log entry form -->
        <form
          [formGroup]="form"
          (ngSubmit)="onLog()"
          class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-start mb-5"
          aria-label="Log time"
        >
          <div class="flex flex-col gap-1">
            <input
              type="text"
              formControlName="duration"
              placeholder="1h 30m, 1.5h, 90m"
              aria-label="Duration"
              class="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700
                     placeholder:text-slate-400 outline-none transition
                     focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
            />
            @if (durationError()) {
              <span class="text-[11px] text-rose-600" role="alert">
                {{ durationError() }}
              </span>
            }
          </div>
          <input
            type="date"
            formControlName="date"
            aria-label="Date"
            class="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700
                   outline-none transition focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          />
          <input
            type="text"
            formControlName="description"
            placeholder="What did you work on? (optional)"
            aria-label="Description"
            class="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700
                   placeholder:text-slate-400 outline-none transition
                   focus:border-indigo-400 focus:bg-slate-100 focus:ring-2 focus:ring-indigo-500/30"
          />
          <div class="flex items-center gap-3">
            <label class="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                formControlName="billable"
                class="h-4 w-4 rounded border-slate-300 bg-white text-indigo-500
                       focus:ring-indigo-500/40 focus:ring-offset-0 cursor-pointer"
              />
              Billable
            </label>
            <button
              type="submit"
              [disabled]="logging()"
              class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white
                     bg-gradient-to-r from-indigo-600 to-violet-600
                     shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/40
                     transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              Log
            </button>
          </div>
        </form>

        <!-- Entries list -->
        @if (entries().length > 0) {
          <ul class="space-y-2" aria-label="Time entries">
            @for (entry of entries(); track entry.id) {
              <li
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white
                       px-3 py-2 text-sm"
              >
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                         bg-gradient-to-br from-indigo-600 to-violet-600 text-[10px] font-bold text-white"
                  [attr.title]="userDisplayName(entry.userId)"
                >
                  {{ userInitials(entry.userId) }}
                </span>
                <span class="text-xs text-slate-500 tabular-nums w-24 shrink-0">
                  {{ entry.date }}
                </span>
                <span
                  class="text-xs font-semibold text-violet-700 w-20 shrink-0 tabular-nums"
                >
                  {{ formatDuration(entry.durationMinutes) }}
                </span>
                <span class="flex-1 text-xs text-slate-600 truncate">
                  {{ entry.description ?? '—' }}
                </span>
                @if (entry.billable) {
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                           bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    Billable
                  </span>
                }
                @if (canEditEntry(entry)) {
                  <button
                    type="button"
                    (click)="onDelete(entry)"
                    class="text-xs text-rose-600 hover:text-rose-700 transition-colors"
                    [attr.aria-label]="'Delete entry ' + entry.id"
                  >
                    <span class="pi pi-trash" aria-hidden="true"></span>
                  </button>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="text-xs text-slate-500 italic">No time logged on this task yet.</p>
        }
      } @else {
        <!-- Compact mode: button to toggle quick log -->
        <button
          type="button"
          (click)="toggleQuickLog()"
          class="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800"
          [attr.aria-expanded]="quickLogOpen()"
        >
          <span class="pi pi-plus-circle" aria-hidden="true"></span>
          Log
        </button>
        @if (quickLogOpen()) {
          <form
            [formGroup]="form"
            (ngSubmit)="onLog()"
            class="flex gap-2 mt-2"
            aria-label="Quick log time"
          >
            <input
              type="text"
              formControlName="duration"
              placeholder="1h 30m"
              aria-label="Duration"
              class="flex-1 rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs text-slate-700
                     placeholder:text-slate-400 outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              class="rounded-lg px-2 py-1 text-xs font-bold text-white
                     bg-gradient-to-r from-indigo-600 to-violet-600"
            >
              Log
            </button>
          </form>
          @if (durationError()) {
            <span class="text-[11px] text-rose-600 mt-1 block" role="alert">
              {{ durationError() }}
            </span>
          }
        }
      }
    </section>
  `,
})
export class TimeLoggerComponent implements OnInit {
  readonly taskId = input.required<string>();
  readonly compact = input<boolean>(false);

  private readonly store = inject(TimeEntryStore);
  private readonly auth = inject(AuthService);
  private readonly memberStore = inject(WorkspaceMemberStore);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly logging = signal(false);
  readonly busyTimer = signal(false);
  readonly durationError = signal<string | null>(null);
  readonly quickLogOpen = signal(false);

  readonly form = this.fb.nonNullable.group({
    duration: ['', [Validators.required]],
    date: [todayIso(), [Validators.required]],
    description: [''],
    billable: [true],
  });

  readonly entries = computed(() => {
    const tid = this.taskId();
    return this.store
      .items()
      .filter(e => e.taskId === tid)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  });

  readonly totalMinutes = computed(() => this.store.summaryForTask(this.taskId())());

  readonly totalLabel = computed(() => formatMinutes(this.totalMinutes()));

  readonly isActiveTimerForThisTask = computed(
    () => this.store.activeTimer()?.taskId === this.taskId(),
  );

  readonly otherTaskTimer = computed(() => {
    const t = this.store.activeTimer();
    return t && t.taskId !== this.taskId() ? t : null;
  });

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  ngOnInit(): void {
    const tid = this.taskId();
    if (!this.store.isTaskLoaded(tid)) {
      void this.store.loadForTask(tid).catch(() => undefined);
    }
  }

  toggleQuickLog(): void {
    this.quickLogOpen.update(v => !v);
  }

  userInitials(userId: string): string {
    return this.memberStore.initialsFor(userId);
  }

  userDisplayName(userId: string): string {
    const me = this.auth.currentUser();
    if (me?.id === userId) return me.displayName ?? this.memberStore.displayNameFor(userId);
    return this.memberStore.displayNameFor(userId);
  }

  formatDuration(min: number): string {
    return formatMinutes(min);
  }

  canEditEntry(entry: TimeEntry): boolean {
    const me = this.auth.currentUser();
    if (!me) return false;
    return me.id === entry.userId || me.role === 'admin';
  }

  async onLog(): Promise<void> {
    this.durationError.set(null);
    const raw = this.form.controls.duration.value;
    const minutes = parseDurationToMinutes(raw);
    if (minutes === null) {
      this.durationError.set('Invalid duration. Try "1h 30m", "1.5h", or "90m".');
      return;
    }
    const date = this.form.controls.date.value || todayIso();
    const description = this.form.controls.description.value?.trim() || null;
    const billable = !!this.form.controls.billable.value;
    this.logging.set(true);
    try {
      await this.store.create({
        taskId: this.taskId(),
        durationMinutes: minutes,
        date,
        description,
        billable,
      });
      this.form.patchValue({ duration: '', description: '' });
      this.toast.success('Time logged');
    } catch {
      this.toast.error('Failed to log time');
    } finally {
      this.logging.set(false);
    }
  }

  async onStart(): Promise<void> {
    this.busyTimer.set(true);
    try {
      await this.store.start(this.taskId(), null, true);
      this.toast.success('Timer started');
    } catch {
      this.toast.error('Failed to start timer');
    } finally {
      this.busyTimer.set(false);
    }
  }

  async onStop(): Promise<void> {
    this.busyTimer.set(true);
    try {
      const result = await this.store.stop();
      if (result) this.toast.success('Timer stopped');
    } catch {
      this.toast.error('Failed to stop timer');
    } finally {
      this.busyTimer.set(false);
    }
  }

  async onDelete(entry: TimeEntry): Promise<void> {
    try {
      await this.store.delete(entry.id);
      this.toast.success('Entry deleted');
    } catch {
      this.toast.error('Failed to delete entry');
    }
  }
}
