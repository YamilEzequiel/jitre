import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { ProjectApiService, Project } from '../../../stores/project-api.service';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'jt-create-project',
  host: { class: 'block h-full w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TabsModule],
  template: `
    <div class="jitre-editor h-full w-full overflow-hidden bg-white">
      <header class="m-5 rounded-xl border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/25"><i class="pi pi-folder-plus text-lg"></i></span>
            <div>
              <h2 class="text-xl font-black text-slate-950">Crear proyecto</h2>
              <p class="text-sm text-slate-500">Configurá identidad, apariencia y planificación inicial.</p>
            </div>
          </div>
          <button type="button" (click)="cancelled.emit()" class="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Cerrar"><i class="pi pi-times"></i></button>
        </div>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" class="h-[calc(100%_-_7.75rem)] overflow-auto px-5 pb-5" novalidate>
        <p-tabs value="details" [showNavigators]="false">
          <p-tablist>
            <p-tab value="details"><i class="pi pi-file-edit mr-2"></i>Detalles</p-tab>
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
                      <div><label for="project-key" class="mb-2 block text-xs font-semibold text-slate-600">Key <span class="text-rose-500">*</span></label><input id="project-key" type="text" formControlName="key" maxlength="8" (input)="normalizeKey()" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black uppercase text-slate-950 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" placeholder="PORT" /></div>
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
                      <div class="flex items-center gap-4"><div class="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-black text-white shadow-md" [style.background]="form.controls.color.value ?? '#6d28d9'">{{ previewIcon() }}</div><div class="min-w-0"><p class="truncate text-base font-black text-slate-950">{{ form.controls.name.value || 'Nuevo proyecto' }}</p><p class="text-xs font-bold uppercase tracking-wider text-slate-500">{{ form.controls.key.value || 'KEY' }}</p></div></div>
                      <p class="mt-4 text-sm text-slate-500">{{ form.controls.description.value || 'La descripción aparecerá en esta tarjeta.' }}</p>
                    </div>
                  </div>
                </section>
              </div>
            </p-tabpanel>
            <p-tabpanel value="planning">
              <section class="my-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center gap-3 border-b border-slate-100 p-5"><span class="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><i class="pi pi-calendar"></i></span><div><h3 class="text-sm font-black text-slate-950">Ventana de planificación</h3><p class="text-xs text-slate-500">Fechas para roadmap, releases y analytics</p></div></div>
                <div class="grid gap-4 p-5 sm:grid-cols-2"><div><label for="project-start" class="mb-2 block text-xs font-semibold text-slate-600">Inicio</label><input id="project-start" type="date" formControlName="startDate" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></div><div><label for="project-target" class="mb-2 block text-xs font-semibold text-slate-600">Objetivo</label><input id="project-target" type="date" formControlName="targetDate" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></div></div>
              </section>
            </p-tabpanel>
            <p-tabpanel value="appearance">
              <section class="my-5 max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 class="mb-5 text-sm font-black text-slate-950">Marca visual</h3>
                <div class="grid gap-4 sm:grid-cols-2"><div><label for="project-color" class="mb-2 block text-xs font-semibold text-slate-600">Color</label><input id="project-color" type="color" formControlName="color" class="h-12 w-full rounded-xl border border-slate-200 bg-white px-2 py-1" /></div><div><label for="project-icon" class="mb-2 block text-xs font-semibold text-slate-600">Icono</label><input id="project-icon" type="text" formControlName="icon" maxlength="16" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="🚀" /></div></div>
              </section>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
        <footer class="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white/95 px-1 py-5 backdrop-blur">
          <button type="button" (click)="cancelled.emit()" class="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button type="submit" [disabled]="form.invalid || loading()" class="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:bg-violet-700 disabled:opacity-60">{{ loading() ? 'Creando…' : 'Crear proyecto' }}</button>
        </footer>
      </form>
    </div>
  `,
})
export class CreateProjectComponent {
  readonly workspaceId = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ProjectApiService);
  private readonly toast = inject(ToastService);

  readonly created = output<Project>();
  readonly cancelled = output<void>();
  readonly loading = signal(false);

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
  });

  previewIcon(): string {
    const icon = this.form.controls.icon.value?.trim();
    return icon ? icon.slice(0, 2) : '🚀';
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
    try {
      const { name, key, description, color, icon, startDate, targetDate } = this.form.value;
      const project = await this.api.create(workspaceId, {
        name: name!.trim(),
        key: key!,
        description: this.emptyToUndefined(description),
        color: this.emptyToUndefined(color),
        icon: this.emptyToUndefined(icon),
        startDate: this.emptyToUndefined(startDate),
        targetDate: this.emptyToUndefined(targetDate),
      });
      this.toast.success('Project created');
      this.created.emit(project);
      this.form.reset({ name: '', key: '', description: '', color: '#2563eb', icon: '🚀', startDate: '', targetDate: '' });
    } catch {
      this.toast.error('Failed to create project');
    } finally {
      this.loading.set(false);
    }
  }

  private emptyToUndefined(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
