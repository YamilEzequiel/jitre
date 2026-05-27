import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import {
  CustomFieldApiService,
  CustomFieldDefinition,
} from '../../stores/custom-field-api.service';
import { ProjectMemberStore } from '../../stores/project-member.store';
import { CheckboxComponent } from '../checkbox/checkbox.component';

/**
 * Renders the project's typed custom fields as a dynamic form.
 *
 * Why a single renderer instead of inlining inputs per consumer:
 * - Definitions live per project; every task form would otherwise have to
 *   duplicate the load + render logic.
 * - Field type → input is a thin mapping table that's much easier to maintain
 *   in one place than in 4 different templates (create-task, task-detail,
 *   AI commit dialog, …).
 *
 * Contract:
 *   [projectId]: which project's fields to render.
 *   [values]:    Record<fieldName, unknown> with the currently stored values.
 *   (valuesChange): emits the merged record whenever any field changes.
 */
@Component({
  selector: 'jt-custom-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, CheckboxComponent],
  template: `
    @if (loading()) {
      <p class="text-xs text-slate-400">Cargando campos…</p>
    } @else if (definitions().length === 0) {
      <p class="text-xs italic text-slate-400">Este proyecto no tiene campos personalizados.</p>
    } @else {
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        @for (def of definitions(); track def.id) {
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {{ def.name }}
              @if (def.required) { <span class="text-rose-500">*</span> }
            </label>

            @switch (def.type) {
              @case ('text') {
                <input type="text"
                       [ngModel]="currentValue(def)"
                       (ngModelChange)="setValue(def, $event)"
                       class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
              }
              @case ('number') {
                <input type="number"
                       [ngModel]="currentValue(def)"
                       (ngModelChange)="setValue(def, $event === null ? null : Number($event))"
                       class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
              }
              @case ('date') {
                <input type="date"
                       [ngModel]="currentValue(def)"
                       (ngModelChange)="setValue(def, $event)"
                       class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
              }
              @case ('boolean') {
                <span class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
                  <jt-checkbox
                    [checked]="!!currentValue(def)"
                    (checkedChange)="setValue(def, $event)"
                    label="Sí"
                  />
                </span>
              }
              @case ('select') {
                <p-select [ngModel]="currentValue(def)"
                          (ngModelChange)="setValue(def, $event)"
                          [options]="optionsFor(def)"
                          optionLabel="label" optionValue="value"
                          placeholder="Elegir…" [showClear]="true"
                          appendTo="body" size="small" />
              }
              @case ('multi_select') {
                <div class="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
                  @for (opt of def.options ?? []; track opt) {
                    <span class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:border-violet-300">
                      <jt-checkbox
                        size="sm"
                        [checked]="isMultiSelected(def, opt)"
                        (checkedChange)="toggleMulti(def, opt)"
                      />
                      {{ opt }}
                    </span>
                  }
                </div>
              }
              @case ('user') {
                <p-select [ngModel]="currentValue(def)"
                          (ngModelChange)="setValue(def, $event)"
                          [options]="memberOptions()"
                          optionLabel="label" optionValue="value"
                          placeholder="Elegir usuario…" [showClear]="true" [filter]="true"
                          appendTo="body" size="small" />
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class CustomFieldsRendererComponent implements OnInit, OnChanges {
  readonly projectId = input.required<string>();
  readonly values = input<Record<string, unknown>>({});
  readonly valuesChange = output<Record<string, unknown>>();

  private readonly api = inject(CustomFieldApiService);
  private readonly memberStore = inject(ProjectMemberStore);

  protected readonly Number = Number;

  readonly definitions = signal<CustomFieldDefinition[]>([]);
  readonly loading = signal(false);

  private localValues: Record<string, unknown> = {};

  readonly memberOptions = computed(() =>
    this.memberStore
      .byProject(this.projectId())()
      .map((m) => ({ label: m.displayName ?? m.email ?? m.userId, value: m.userId })),
  );

  async ngOnInit(): Promise<void> {
    this.localValues = { ...this.values() };
    await this.load();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['values']) {
      this.localValues = { ...(this.values() ?? {}) };
    }
    if (changes['projectId']) {
      await this.load();
    }
  }

  currentValue(def: CustomFieldDefinition): unknown {
    return this.localValues[def.name];
  }

  setValue(def: CustomFieldDefinition, value: unknown): void {
    this.localValues = { ...this.localValues, [def.name]: value };
    this.valuesChange.emit(this.localValues);
  }

  optionsFor(def: CustomFieldDefinition): Array<{ label: string; value: string }> {
    return (def.options ?? []).map((o) => ({ label: o, value: o }));
  }

  isMultiSelected(def: CustomFieldDefinition, option: string): boolean {
    const current = this.localValues[def.name];
    return Array.isArray(current) && (current as string[]).includes(option);
  }

  toggleMulti(def: CustomFieldDefinition, option: string): void {
    const current = (this.localValues[def.name] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((x) => x !== option)
      : [...current, option];
    this.setValue(def, next);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const defs = await this.api.listForProject(this.projectId());
      this.definitions.set(defs);
      // Trigger initial member load so the `user` field has options.
      void this.memberStore.loadForProject(this.projectId());
    } catch {
      this.definitions.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
