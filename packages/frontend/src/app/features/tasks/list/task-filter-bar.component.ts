import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TaskPriority, TaskType } from '../../../stores/task-api.service';

export interface StatusOption {
  id: string;
  name: string;
}

export interface AssigneeOption {
  userId: string;
  label?: string;
}

export interface LabelOption {
  id: string;
  name: string;
}

export interface TaskFilters {
  statusId?: string | null;
  assigneeUserId?: string | null;
  labelId?: string | null;
  priority?: TaskPriority | null;
  type?: TaskType | null;
  q?: string;
}

const PRIORITY_OPTS: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const TYPE_OPTS: TaskType[] = ['task', 'bug', 'incident', 'feature'];

@Component({
  selector: 'jt-task-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="rounded-xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-200/70">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative flex-1 min-w-[16rem] max-w-md">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            [formControl]="searchControl"
            class="w-full text-sm rounded-xl bg-slate-50 border border-slate-200
                   pl-9 pr-3 py-2 text-slate-950 placeholder:text-slate-400 outline-none transition
                   focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
            placeholder="Buscar tareas, bugs o features..."
            aria-label="Search tasks"
          />
        </div>

        <select
          [formControl]="statusControl"
          class="text-sm rounded-xl bg-slate-50 border border-slate-200
                 px-3 py-2 text-slate-800 outline-none transition
                 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
          aria-label="Filter by status"
        >
          <option [value]="null">Todos los estados</option>
          @for (opt of statusOptions(); track opt.id) {
            <option [value]="opt.id">{{ opt.name }}</option>
          }
        </select>

        <select
          [formControl]="typeControl"
          class="text-sm rounded-xl bg-slate-50 border border-slate-200
                 px-3 py-2 text-slate-800 outline-none transition capitalize
                 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
          aria-label="Filter by type"
        >
          <option [value]="null">Todos los tipos</option>
          @for (t of typeOpts; track t) {
            <option [value]="t" class="capitalize">{{ t }}</option>
          }
        </select>

        <select
          [formControl]="priorityControl"
          class="text-sm rounded-xl bg-slate-50 border border-slate-200
                 px-3 py-2 text-slate-800 outline-none transition capitalize
                 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
          aria-label="Filter by priority"
        >
          <option [value]="null">Todas las prioridades</option>
          @for (p of priorityOpts; track p) {
            <option [value]="p" class="capitalize">{{ p }}</option>
          }
        </select>

        @if (assigneeOptions().length > 0) {
          <select
            [formControl]="assigneeControl"
            class="text-sm rounded-xl bg-slate-50 border border-slate-200
                   px-3 py-2 text-slate-800 outline-none transition max-w-[11rem]
                   focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
            aria-label="Filter by assignee"
          >
            <option [value]="null">Todos los responsables</option>
            @for (a of assigneeOptions(); track a.userId) {
              <option [value]="a.userId">{{ a.label ?? a.userId }}</option>
            }
          </select>
        }

        @if (labelOptions().length > 0) {
          <select
            [formControl]="labelControl"
            class="text-sm rounded-xl bg-slate-50 border border-slate-200
                   px-3 py-2 text-slate-800 outline-none transition max-w-[11rem]
                   focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
            aria-label="Filter by label"
          >
            <option [value]="null">Todas las etiquetas</option>
            @for (l of labelOptions(); track l.id) {
              <option [value]="l.id">{{ l.name }}</option>
            }
          </select>
        }

        <button
          (click)="reset()"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600
                 bg-white border border-slate-200
                 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-950
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  `,
})
export class TaskFilterBarComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private subs = new Subscription();

  readonly statusOptions = input<StatusOption[]>([]);
  readonly assigneeOptions = input<AssigneeOption[]>([]);
  readonly labelOptions = input<LabelOption[]>([]);

  readonly filterChange = output<TaskFilters>();

  readonly statusControl = this.fb.control<string | null>(null);
  readonly priorityControl = this.fb.control<TaskPriority | null>(null);
  readonly typeControl = this.fb.control<TaskType | null>(null);
  readonly assigneeControl = this.fb.control<string | null>(null);
  readonly labelControl = this.fb.control<string | null>(null);
  readonly searchControl = this.fb.control('');

  readonly priorityOpts = PRIORITY_OPTS;
  readonly typeOpts = TYPE_OPTS;

  ngOnInit(): void {
    const immediate = [
      this.statusControl,
      this.priorityControl,
      this.typeControl,
      this.assigneeControl,
      this.labelControl,
    ];
    for (const c of immediate) {
      this.subs.add(
        c.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.emit()),
      );
    }
    this.subs.add(
      this.searchControl.valueChanges
        .pipe(debounceTime(200), distinctUntilChanged())
        .subscribe(() => this.emit()),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  reset(): void {
    this.statusControl.setValue(null, { emitEvent: false });
    this.priorityControl.setValue(null, { emitEvent: false });
    this.typeControl.setValue(null, { emitEvent: false });
    this.assigneeControl.setValue(null, { emitEvent: false });
    this.labelControl.setValue(null, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.emit();
  }

  private emit(): void {
    this.filterChange.emit({
      statusId: this.statusControl.value,
      priority: this.priorityControl.value,
      type: this.typeControl.value,
      assigneeUserId: this.assigneeControl.value,
      labelId: this.labelControl.value,
      q: this.searchControl.value ?? '',
    });
  }
}
