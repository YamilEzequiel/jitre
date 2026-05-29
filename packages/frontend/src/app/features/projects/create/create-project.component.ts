import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { ProjectApiService, Project, UpdateProjectBody } from '../../../stores/project-api.service';
import { AreaStore } from '../../../stores/area.store';
import { CustomerStore } from '../../../stores/customer.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Accepts `https://...`, `http://...` or `git@host:path` style URLs. Empty
 * string passes (the field is optional); the backend trims further. Defined
 * outside the component so we can swap to a stricter check without touching
 * the template wiring.
 */
function isValidRepositoryUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (/^https?:\/\/\S+$/i.test(v)) return true;
  if (/^git@[\w.\-]+:\S+$/i.test(v)) return true;
  return false;
}

function repositoryUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string | null) ?? '';
  return isValidRepositoryUrl(value) ? null : { repositoryUrl: true };
}

@Component({
  selector: 'jt-create-project',
  host: { class: 'block h-full w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TabsModule, SelectModule],
  template: `
    <div class="jitre-editor h-full w-full overflow-hidden bg-white">
      <header class="m-5 rounded-xl border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/25">
              <i [class]="isEditMode() ? 'pi pi-folder-open text-lg' : 'pi pi-folder-plus text-lg'"></i>
            </span>
            <div>
              <h2 class="text-xl font-black text-slate-950">{{ isEditMode() ? 'Editar proyecto' : 'Crear proyecto' }}</h2>
              <p class="text-sm text-slate-500">{{ isEditMode() ? 'Actualizá identidad, metadata y planificación.' : 'Configurá identidad, apariencia y planificación inicial.' }}</p>
            </div>
          </div>
          <button type="button" (click)="cancelled.emit()" class="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Cerrar"><i class="pi pi-times"></i></button>
        </div>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" class="h-[calc(100%_-_7.75rem)] overflow-auto px-5 pb-5" novalidate>
        <p-tabs value="details" [showNavigators]="false">
          <p-tablist>
            <p-tab value="details"><i class="pi pi-file-edit mr-2"></i>Detalles</p-tab>
            <p-tab value="metadata"><i class="pi pi-tags mr-2"></i>Metadata</p-tab>
            <p-tab value="planning"><i class="pi pi-calendar mr-2"></i>Planificación</p-tab>
            <p-tab value="appearance"><i class="pi pi-palette mr-2"></i>Apariencia</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="details">
              <div class="grid gap-5 py-5 lg:grid-cols-[1.15fr_.85fr]">
                <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                    <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><i class="pi pi-tag"></i></span>
                    <div><h3 class="text-sm font-black text-slate-950">Identificación</h3><p class="text-xs text-slate-500">Nombre, clave y objetivo del proyecto</p></div>
                  </div>
                  <div class="space-y-4 p-5">
                    <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
                      <div><label for="project-name" class="mb-2 block text-xs font-semibold text-slate-600">Nombre del proyecto <span class="text-rose-500">*</span></label><input id="project-name" type="text" formControlName="name" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" placeholder="Portal clientes" /></div>
                      <div>
                        <label for="project-key" class="mb-2 block text-xs font-semibold text-slate-600">
                          Key <span class="text-rose-500">*</span>
                          @if (isEditMode()) { <span class="ml-1 font-normal text-slate-400">(inmutable)</span> }
                        </label>
                        <input
                          id="project-key" type="text" formControlName="key" maxlength="8" (input)="normalizeKey()"
                          [class.cursor-not-allowed]="isEditMode()"
                          [class.bg-slate-50]="isEditMode()"
                          [class.text-slate-500]="isEditMode()"
                          class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black uppercase text-slate-950 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                          placeholder="PORT" />
                      </div>
                    </div>
                    <div><label for="project-desc" class="mb-2 block text-xs font-semibold text-slate-600">Descripción</label><textarea id="project-desc" formControlName="description" rows="5" class="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" placeholder="Objetivo, alcance y responsables..."></textarea></div>
                  </div>
                </section>
                <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                    <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><i class="pi pi-eye"></i></span>
                    <div><h3 class="text-sm font-black text-slate-950">Vista previa</h3><p class="text-xs text-slate-500">Así lo verá el equipo</p></div>
                  </div>
                  <div class="p-5">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div class="flex items-center gap-4">
                        <div class="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-black text-white shadow-md"
                             [style.background]="form.controls.color.value ?? '#6d28d9'">
                          @if (isPiPreviewIcon()) {
                            <i [class]="'pi ' + form.controls.icon.value"></i>
                          } @else {
                            {{ previewIcon() }}
                          }
                        </div>
                        <div class="min-w-0"><p class="truncate text-base font-black text-slate-950">{{ form.controls.name.value || 'Nuevo proyecto' }}</p><p class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ form.controls.key.value || 'KEY' }}</p></div>
                      </div>
                      <p class="mt-4 text-sm text-slate-500">{{ form.controls.description.value || 'La descripción aparecerá en esta tarjeta.' }}</p>
                    </div>
                  </div>
                </section>
              </div>
            </p-tabpanel>
            <p-tabpanel value="metadata">
              <section class="my-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                  <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><i class="pi pi-tags"></i></span>
                  <div>
                    <h3 class="text-sm font-black text-slate-950">Stack y atribución</h3>
                    <p class="text-xs text-slate-500">Área responsable, framework, cliente y repo. Todo opcional.</p>
                  </div>
                </div>
                <div class="grid gap-4 p-5 sm:grid-cols-2">
                  <div>
                    <label for="project-area" class="mb-2 block text-xs font-semibold text-slate-600">Área</label>
                    <p-select
                      inputId="project-area"
                      formControlName="areaId"
                      [options]="areaSelectOptions()"
                      optionLabel="label"
                      optionValue="value"
                      appendTo="body"
                      [showClear]="true"
                      placeholder="Sin área"
                      styleClass="w-full"
                    />
                  </div>
                  <div>
                    <label for="project-category" class="mb-2 block text-xs font-semibold text-slate-600">Categoría</label>
                    <input id="project-category" type="text" formControlName="category" maxlength="40"
                           class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                           placeholder="Producto interno, Outsourcing…" />
                  </div>
                  <div>
                    <label for="project-framework" class="mb-2 block text-xs font-semibold text-slate-600">Framework</label>
                    <input id="project-framework" type="text" formControlName="framework" maxlength="60"
                           class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                           placeholder="Angular 21, NestJS 11…" />
                  </div>
                  <div>
                    <label for="project-database" class="mb-2 block text-xs font-semibold text-slate-600">Base de datos</label>
                    <input id="project-database" type="text" formControlName="database" maxlength="60"
                           class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                           placeholder="PostgreSQL 16, MongoDB…" />
                  </div>
                  <div>
                    <label for="project-customer" class="mb-2 block text-xs font-semibold text-slate-600">Cliente</label>
                    <p-select
                      inputId="project-customer"
                      formControlName="customerId"
                      [options]="customerSelectOptions()"
                      optionLabel="label"
                      optionValue="value"
                      appendTo="body"
                      [showClear]="true"
                      [filter]="true"
                      placeholder="Sin cliente"
                      styleClass="w-full"
                    />
                    <p class="mt-1 text-[10px] text-slate-400">
                      ¿No está en la lista?
                      <a href="/customers" target="_blank" class="font-semibold text-violet-600 hover:underline">Crearlo en Clientes</a>
                    </p>
                  </div>
                  <div class="sm:col-span-2">
                    <label for="project-repo" class="mb-2 block text-xs font-semibold text-slate-600">Repositorio (URL)</label>
                    <input id="project-repo" type="text" formControlName="repositoryUrl"
                           class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono"
                           placeholder="https://github.com/empresa/proyecto o git@github.com:empresa/proyecto.git" />
                    @if (form.controls.repositoryUrl.touched && form.controls.repositoryUrl.invalid) {
                      <p class="mt-1 text-[11px] font-semibold text-rose-600">
                        La URL debe empezar con <code>https://</code>, <code>http://</code> o <code>git@</code>.
                      </p>
                    }
                  </div>
                </div>
              </section>
            </p-tabpanel>
            <p-tabpanel value="planning">
              <section class="my-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center gap-3 border-b border-slate-100 p-5"><span class="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><i class="pi pi-calendar"></i></span><div><h3 class="text-sm font-black text-slate-950">Ventana de planificación</h3><p class="text-xs text-slate-500">Fechas para roadmap, releases y analytics</p></div></div>
                <div class="grid gap-4 p-5 sm:grid-cols-2"><div><label for="project-start" class="mb-2 block text-xs font-semibold text-slate-600">Inicio</label><input id="project-start" type="date" formControlName="startDate" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></div><div><label for="project-target" class="mb-2 block text-xs font-semibold text-slate-600">Objetivo</label><input id="project-target" type="date" formControlName="targetDate" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></div></div>
              </section>
            </p-tabpanel>
            <p-tabpanel value="appearance">
              <section class="my-5 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 class="mb-5 text-sm font-black text-slate-950">Marca visual</h3>
                <div class="grid gap-5 sm:grid-cols-[14rem_1fr]">
                  <div>
                    <label for="project-color" class="mb-2 block text-xs font-semibold text-slate-600">Color</label>
                    <input id="project-color" type="color" formControlName="color" class="h-12 w-full rounded-xl border border-slate-200 bg-white px-2 py-1" />
                    <div class="mt-4 flex items-center gap-3">
                      <div class="flex h-16 w-16 items-center justify-center rounded-xl text-3xl text-white shadow-md"
                           [style.background]="form.controls.color.value ?? '#6d28d9'">
                        @if (isPiPreviewIcon()) {
                          <i [class]="'pi ' + form.controls.icon.value"></i>
                        } @else {
                          {{ previewIcon() }}
                        }
                      </div>
                      <div class="text-xs text-slate-500">
                        <p class="font-semibold text-slate-700">Vista previa</p>
                        <p>El icono se muestra sobre el color elegido.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="mb-2 block text-xs font-semibold text-slate-600">Icono</label>
                    <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                      @for (preset of iconPresets; track preset) {
                        <button
                          type="button"
                          (click)="selectIcon(preset)"
                          [class.ring-2]="form.controls.icon.value === preset"
                          [class.ring-violet-500]="form.controls.icon.value === preset"
                          [class.border-violet-300]="form.controls.icon.value === preset"
                          class="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-xl transition-colors hover:border-violet-300 hover:bg-violet-50"
                          [attr.aria-label]="'Usar icono ' + preset"
                          [attr.aria-pressed]="form.controls.icon.value === preset"
                        >{{ preset }}</button>
                      }
                    </div>
                    <label for="project-icon-custom" class="mb-1.5 mt-4 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Personalizado</label>
                    <input
                      id="project-icon-custom" type="text" formControlName="icon" maxlength="16"
                      class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono"
                      placeholder="Pegá un emoji o escribí pi-folder"
                    />
                    <p class="mt-1 text-[11px] text-slate-400">Acepta emojis (🚀) o nombres de PrimeIcons con prefijo <code>pi-</code>.</p>
                  </div>
                </div>
              </section>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
        <footer class="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white/95 px-1 py-5 backdrop-blur">
          <button type="button" (click)="cancelled.emit()" class="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button type="submit" [disabled]="form.invalid || loading()" class="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:bg-violet-700 disabled:opacity-60">
            {{ loading() ? (isEditMode() ? 'Guardando…' : 'Creando…') : (isEditMode() ? 'Guardar cambios' : 'Crear proyecto') }}
          </button>
        </footer>
      </form>
    </div>
  `,
})
export class CreateProjectComponent implements OnInit {
  readonly workspaceId = input.required<string>();
  /**
   * When provided, the form switches to edit mode: fields are prefilled,
   * `key` becomes read-only (immutable per ADR-D8) and submit issues a
   * PATCH instead of a POST. The `created` output fires for both modes
   * with the persisted project so the parent can upsert it into the cache.
   */
  readonly existingProject = input<Project | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ProjectApiService);
  private readonly areaStore = inject(AreaStore);
  private readonly customerStore = inject(CustomerStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly created = output<Project>();
  readonly cancelled = output<void>();
  readonly loading = signal(false);

  readonly isEditMode = computed(() => this.existingProject() !== null);

  /**
   * Emoji presets shown as quick-pick buttons. Manual input still allowed
   * for emojis we didn't anticipate and for `pi-*` PrimeIcons names.
   */
  readonly iconPresets = [
    '🚀', '📊', '💼', '🎯', '🛠️', '🐛', '⚡', '🔐',
    '📱', '🌐', '💡', '✅', '🎨', '🧪', '📦', '🏗️',
  ];

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    key: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(8),
        Validators.pattern(/^[A-Z0-9]+$/),
      ],
    ],
    description: [''],
    color: ['#2563eb'],
    icon: ['🚀'],
    startDate: [''],
    targetDate: [''],
    // Metadata block — all optional.
    areaId: [null as string | null],
    category: ['', [Validators.maxLength(40)]],
    framework: ['', [Validators.maxLength(60)]],
    database: ['', [Validators.maxLength(60)]],
    customerId: [null as string | null],
    repositoryUrl: ['', [repositoryUrlValidator]],
  });

  /** Area select options pulled from the shared cache (workspace-scoped). */
  readonly areaSelectOptions = computed<{ label: string; value: string | null }[]>(() => {
    return [
      { label: 'Sin área', value: null },
      ...this.areaStore.areas().map((a) => ({ label: a.name, value: a.id })),
    ];
  });

  /**
   * Customer select options. Archived customers are filtered out so the
   * picker only surfaces accounts that are currently in use; an existing
   * project pointing at an archived customer keeps its value (the missing
   * label simply shows the raw id, which is fine until the admin reactivates
   * it from the Customers ABM).
   */
  readonly customerSelectOptions = computed<{ label: string; value: string | null }[]>(() => {
    return [
      { label: 'Sin cliente', value: null },
      ...this.customerStore.active().map((c) => ({ label: c.name, value: c.id })),
    ];
  });

  async ngOnInit(): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (workspaceId) {
      // Best-effort — the form still works without these caches (just shows
      // "Sin área" / "Sin cliente" as the only option).
      await Promise.all([
        this.areaStore.load(workspaceId).catch(() => undefined),
        this.customerStore.load(workspaceId).catch(() => undefined),
      ]);
    }

    const existing = this.existingProject();
    if (existing) {
      this.form.patchValue({
        name: existing.name,
        key: existing.key,
        description: existing.description ?? '',
        color: existing.color ?? '#2563eb',
        icon: existing.icon ?? '🚀',
        startDate: existing.startDate ?? '',
        targetDate: existing.targetDate ?? '',
        areaId: existing.areaId ?? null,
        category: existing.category ?? '',
        framework: existing.framework ?? '',
        database: existing.database ?? '',
        customerId: existing.customerId ?? null,
        repositoryUrl: existing.repositoryUrl ?? '',
      });
      this.form.controls.key.disable();
    }
  }

  /**
   * Render-safe preview value for the form's icon control.
   *
   * - Empty → default rocket emoji.
   * - Single emoji (or short visual symbol up to ~4 code units) → render it.
   * - Legacy strings like "rocket" or "folder-plus" (seed data without `pi-`
   *   prefix) → show a small placeholder so the user can see the field
   *   needs a real value instead of leaking the raw word into the preview.
   * - PrimeIcons (`pi-foo`) → handled separately in the template via
   *   `isPiPreviewIcon()`.
   */
  previewIcon(): string {
    const icon = this.form.controls.icon.value?.trim();
    if (!icon) return '🚀';
    if (icon.startsWith('pi-')) return '';
    // Emojis are typically 1-2 chars but combined glyphs reach 4 code units.
    // Anything longer is almost certainly a legacy "name" (e.g. "rocket").
    if (icon.length > 4) return '✨';
    return icon;
  }

  isPiPreviewIcon(): boolean {
    const icon = this.form.controls.icon.value?.trim();
    return !!icon && icon.startsWith('pi-');
  }

  selectIcon(icon: string): void {
    this.form.controls.icon.setValue(icon);
  }

  normalizeKey(): void {
    const control = this.form.controls.key;
    const normalized = (control.value ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    if (control.value !== normalized) {
      control.setValue(normalized, { emitEvent: false });
    }
  }

  async submit(): Promise<void> {
    const workspaceId = this.workspaceId();
    if (this.form.invalid || !workspaceId) return;
    this.loading.set(true);
    const existing = this.existingProject();
    try {
      // getRawValue includes disabled controls (key in edit mode).
      const {
        name,
        key,
        description,
        color,
        icon,
        startDate,
        targetDate,
        areaId,
        category,
        framework,
        database,
        customerId,
        repositoryUrl,
      } = this.form.getRawValue();

      const body = {
        name: name!.trim(),
        description: this.emptyToUndefined(description),
        color: this.emptyToUndefined(color),
        icon: this.emptyToUndefined(icon),
        startDate: this.emptyToUndefined(startDate),
        targetDate: this.emptyToUndefined(targetDate),
        areaId: areaId ?? null,
        category: this.emptyToUndefined(category),
        framework: this.emptyToUndefined(framework),
        database: this.emptyToUndefined(database),
        customerId: customerId ?? null,
        repositoryUrl: this.emptyToUndefined(repositoryUrl),
      };

      let project: Project;
      if (existing) {
        // PATCH: key is intentionally omitted (immutable per ADR-D8).
        project = await this.api.update(existing.id, body satisfies UpdateProjectBody);
        this.toast.success('Project updated');
      } else {
        project = await this.api.create(workspaceId, { ...body, key: key! });
        this.toast.success('Project created');
      }
      this.created.emit(project);

      if (!existing) {
        this.form.reset({
          name: '',
          key: '',
          description: '',
          color: '#2563eb',
          icon: '🚀',
          startDate: '',
          targetDate: '',
          areaId: null,
          category: '',
          framework: '',
          database: '',
          customerId: null,
          repositoryUrl: '',
        });
      }
    } catch {
      this.toast.error(existing ? 'Failed to update project' : 'Failed to create project');
    } finally {
      this.loading.set(false);
    }
  }

  private emptyToUndefined(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
