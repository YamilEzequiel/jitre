import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Employee, EmployeeApiService, UpdateEmployeeBody } from '../../stores/employee-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

@Component({
  selector: 'jt-employees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, TableModule, DatePipe],
  template: `
    <div class="space-y-6 max-w-7xl">
      <!-- Header -->
      <header
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 flex flex-wrap items-end justify-between gap-4"
      >
        <div class="space-y-3">
          <div class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
            <span class="pi pi-users text-violet-600" aria-hidden="true"></span>
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Empleados</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black tracking-tight leading-[1.05]">
            <span class="block bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
              Directorio
            </span>
          </h1>
          <p class="text-xs text-slate-500">
            {{ filtered().length }} de {{ employees().length }} empleados
            @if (canManage()) {
              · <span class="text-violet-700 font-semibold">Modo admin</span>
            }
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true"></i>
            <input
              type="search"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="Buscar por nombre, email, puesto…"
              class="w-72 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div class="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button type="button" (click)="viewMode.set('list')"
                    [class]="'px-3 py-2 text-xs font-bold transition ' + (viewMode() === 'list' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')"
                    aria-label="Vista lista">
              <i class="pi pi-list text-xs" aria-hidden="true"></i>
            </button>
            <button type="button" (click)="viewMode.set('grid')"
                    [class]="'px-3 py-2 text-xs font-bold transition ' + (viewMode() === 'grid' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50')"
                    aria-label="Vista cuadrícula">
              <i class="pi pi-th-large text-xs" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- LIST view (default) -->
      @if (viewMode() === 'list') {
        <section class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-200/70" aria-label="Employee table">
          <div class="max-h-[calc(100vh-18rem)] overflow-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th class="px-4 py-3 text-left font-bold w-12"></th>
                  <th class="px-4 py-3 text-left font-bold">Nombre</th>
                  <th class="px-4 py-3 text-left font-bold">Email</th>
                  <th class="px-4 py-3 text-left font-bold">Puesto</th>
                  <th class="px-4 py-3 text-left font-bold">Departamento</th>
                  <th class="px-4 py-3 text-left font-bold">Código</th>
                  <th class="px-4 py-3 text-left font-bold">Ingreso</th>
                  <th class="px-4 py-3 text-left font-bold">Rol</th>
                  <th class="px-4 py-3 text-right font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (emp of filtered(); track emp.id) {
                  <tr class="border-t border-slate-100 transition-colors hover:bg-violet-50/40 cursor-pointer"
                      (click)="open(emp)"
                      (keydown.enter)="open(emp)"
                      tabindex="0"
                      role="button">
                    <td class="px-4 py-2.5">
                      <span class="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold"
                            [style.background]="avatarBg(emp.id)"
                            [style.color]="avatarFg(emp.id)">
                        @if (emp.avatarUrl) {
                          <img [src]="emp.avatarUrl" alt="" class="h-full w-full rounded-full object-cover" />
                        } @else {
                          {{ initials(emp.displayName) }}
                        }
                      </span>
                    </td>
                    <td class="px-4 py-2.5">
                      <p class="font-semibold text-slate-950 truncate max-w-[14rem]">{{ emp.displayName }}</p>
                    </td>
                    <td class="px-4 py-2.5 text-slate-600 truncate max-w-[14rem]">{{ emp.email }}</td>
                    <td class="px-4 py-2.5 text-slate-700 truncate max-w-[12rem]">{{ emp.position || '—' }}</td>
                    <td class="px-4 py-2.5 text-slate-600 truncate max-w-[10rem]">{{ emp.department || '—' }}</td>
                    <td class="px-4 py-2.5 font-mono text-xs text-slate-500">{{ emp.employeeCode || '—' }}</td>
                    <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {{ emp.hireDate ? (emp.hireDate | date:'mediumDate') : '—' }}
                    </td>
                    <td class="px-4 py-2.5">
                      <span [class]="'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' + roleBadgeClass(emp.workspaceRole)">
                        {{ emp.workspaceRole }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      <button type="button" (click)="open(emp); $event.stopPropagation()"
                              class="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700"
                              aria-label="Editar">
                        <i class="pi pi-pencil text-xs" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="px-4 py-12 text-center text-sm text-slate-400 italic">
                      No hay empleados que coincidan con la búsqueda.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else {
        <!-- GRID view -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Employee grid">
          @for (emp of filtered(); track emp.id) {
            <article
              class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 transition-shadow hover:shadow-md hover:shadow-violet-200/60 cursor-pointer"
              (click)="open(emp)"
              (keydown.enter)="open(emp)"
              tabindex="0"
              role="button"
              [attr.aria-label]="'Abrir perfil de ' + emp.displayName"
            >
              <div class="flex items-start gap-4">
                <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                      [style.background]="avatarBg(emp.id)"
                      [style.color]="avatarFg(emp.id)">
                  @if (emp.avatarUrl) {
                    <img [src]="emp.avatarUrl" alt="" class="h-full w-full rounded-2xl object-cover" />
                  } @else {
                    {{ initials(emp.displayName) }}
                  }
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate text-base font-bold text-slate-950">{{ emp.displayName }}</h3>
                  <p class="truncate text-xs text-slate-500">{{ emp.email }}</p>
                  @if (emp.position) {
                    <p class="mt-2 text-xs text-slate-700"><i class="pi pi-briefcase text-[10px] mr-1" aria-hidden="true"></i>{{ emp.position }}</p>
                  }
                  @if (emp.department) {
                    <p class="text-xs text-slate-500"><i class="pi pi-building text-[10px] mr-1" aria-hidden="true"></i>{{ emp.department }}</p>
                  }
                </div>
                <span [class]="'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' + roleBadgeClass(emp.workspaceRole)">
                  {{ emp.workspaceRole }}
                </span>
              </div>
            </article>
          } @empty {
            <div class="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <p class="text-sm text-slate-500">No hay empleados que coincidan con la búsqueda.</p>
            </div>
          }
        </section>
      }

      <!-- Detail / edit panel -->
      @if (selected(); as emp) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          (click)="close()"
        >
          <div
            class="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            (click)="$event.stopPropagation()"
          >
            <header class="mb-5 flex items-start justify-between gap-4">
              <div class="flex items-center gap-4">
                <span
                  class="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
                  [style.background]="avatarBg(emp.id)"
                  [style.color]="avatarFg(emp.id)"
                >
                  @if (emp.avatarUrl) {
                    <img [src]="emp.avatarUrl" alt="" class="h-full w-full rounded-2xl object-cover" />
                  } @else {
                    {{ initials(emp.displayName) }}
                  }
                </span>
                <div>
                  <h2 class="text-xl font-black text-slate-950">{{ emp.displayName }}</h2>
                  <p class="text-sm text-slate-500">{{ emp.email }}</p>
                  @if (canEdit(emp)) {
                    <button
                      type="button"
                      (click)="fileInput.click()"
                      class="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700"
                    >
                      <i class="pi pi-camera text-[10px]" aria-hidden="true"></i>
                      Cambiar foto
                    </button>
                    <input
                      #fileInput
                      type="file"
                      accept="image/*"
                      class="hidden"
                      (change)="onAvatarSelected($event, emp)"
                    />
                  }
                </div>
              </div>
              <button
                type="button"
                (click)="close()"
                class="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cerrar"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </header>

            @if (canEdit(emp)) {
              <form (ngSubmit)="save(emp)" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="flex flex-col gap-1">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Nombre</span>
                  <input type="text" [(ngModel)]="form.displayName" name="displayName"
                         class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Email</span>
                  <input type="email" [(ngModel)]="form.email" name="email"
                         class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teléfono</span>
                  <input type="tel" [(ngModel)]="form.phone" name="phone"
                         class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                </label>
                @if (canManage()) {
                  <label class="flex flex-col gap-1">
                    <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Código de empleado</span>
                    <input type="text" [(ngModel)]="form.employeeCode" name="employeeCode"
                           class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Puesto</span>
                    <input type="text" [(ngModel)]="form.position" name="position"
                           class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Departamento</span>
                    <input type="text" [(ngModel)]="form.department" name="department"
                           class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Fecha de ingreso</span>
                    <input type="date" [(ngModel)]="form.hireDate" name="hireDate"
                           class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Estado</span>
                    <p-select
                      [(ngModel)]="form.status"
                      name="status"
                      [options]="statusOptions"
                      optionLabel="label"
                      optionValue="value"
                      appendTo="body"
                    />
                  </label>
                }
                <label class="flex flex-col gap-1">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Fecha de nacimiento</span>
                  <input type="date" [(ngModel)]="form.birthDate" name="birthDate"
                         class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                </label>
                <label class="sm:col-span-2 flex flex-col gap-1">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Dirección</span>
                  <input type="text" [(ngModel)]="form.address" name="address"
                         class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                </label>
                <label class="sm:col-span-2 flex flex-col gap-1">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Contacto de emergencia</span>
                  <input type="text" [(ngModel)]="form.emergencyContact" name="emergencyContact" placeholder="Nombre y teléfono"
                         class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                </label>
                <label class="sm:col-span-2 flex flex-col gap-1">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Bio / notas</span>
                  <textarea rows="4" [(ngModel)]="form.bio" name="bio"
                            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"></textarea>
                </label>

                <div class="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                  <button type="button" (click)="close()"
                          class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                    Cancelar
                  </button>
                  <button type="submit" [disabled]="saving()"
                          class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                    @if (saving()) {
                      <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i> Guardando…
                    } @else {
                      <i class="pi pi-check text-xs" aria-hidden="true"></i> Guardar
                    }
                  </button>
                </div>
              </form>
            } @else {
              <!-- Read-only view -->
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Puesto</dt><dd class="text-slate-900">{{ emp.position || '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Departamento</dt><dd class="text-slate-900">{{ emp.department || '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Teléfono</dt><dd class="text-slate-900">{{ emp.phone || '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Código</dt><dd class="text-slate-900 font-mono">{{ emp.employeeCode || '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ingreso</dt><dd class="text-slate-900">{{ emp.hireDate ? (emp.hireDate | date) : '—' }}</dd></div>
                <div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nacimiento</dt><dd class="text-slate-900">{{ emp.birthDate ? (emp.birthDate | date) : '—' }}</dd></div>
                <div class="sm:col-span-2"><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dirección</dt><dd class="text-slate-900">{{ emp.address || '—' }}</dd></div>
                <div class="sm:col-span-2"><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Emergencia</dt><dd class="text-slate-900">{{ emp.emergencyContact || '—' }}</dd></div>
                @if (emp.bio) {
                  <div class="sm:col-span-2"><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bio</dt><dd class="text-slate-900 whitespace-pre-wrap">{{ emp.bio }}</dd></div>
                }
              </dl>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class EmployeesComponent implements OnInit {
  private readonly api = inject(EmployeeApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly initials = initials;

  readonly employees = signal<Employee[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly selected = signal<Employee | null>(null);
  readonly search = signal('');
  readonly viewMode = signal<'list' | 'grid'>('list');

  protected readonly statusOptions = [
    { label: 'Activo', value: 'active' },
    { label: 'Deshabilitado', value: 'disabled' },
  ];

  form: UpdateEmployeeBody = {};

  readonly canManage = computed(() => this.auth.currentUser()?.role === 'admin');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.employees();
    return this.employees().filter((e) => {
      return (
        e.displayName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q)
      );
    });
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.list();
      this.employees.set(list);
    } catch {
      this.toast.error('No pudimos cargar los empleados');
    } finally {
      this.loading.set(false);
    }
  }

  canEdit(emp: Employee): boolean {
    return this.canManage() || this.auth.currentUser()?.id === emp.id;
  }

  open(emp: Employee): void {
    this.selected.set(emp);
    this.form = {
      displayName: emp.displayName ?? '',
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      position: emp.position ?? '',
      department: emp.department ?? '',
      hireDate: emp.hireDate ?? '',
      birthDate: emp.birthDate ?? '',
      address: emp.address ?? '',
      bio: emp.bio ?? '',
      employeeCode: emp.employeeCode ?? '',
      emergencyContact: emp.emergencyContact ?? '',
      status: emp.status ?? 'active',
    };
  }

  close(): void {
    this.selected.set(null);
  }

  async save(emp: Employee): Promise<void> {
    this.saving.set(true);
    try {
      // Convert empty strings to null so the backend clears the column rather
      // than storing literal empty strings.
      const patch: UpdateEmployeeBody = {};
      for (const [k, v] of Object.entries(this.form)) {
        if (v === '' || v === undefined) (patch as Record<string, unknown>)[k] = null;
        else (patch as Record<string, unknown>)[k] = v;
      }
      const updated = await this.api.update(emp.id, patch);
      this.employees.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
      this.selected.set(updated);
      this.toast.success('Cambios guardados');
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail ?? 'No pudimos guardar';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async onAvatarSelected(event: Event, emp: Employee): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.api.uploadAvatar(emp.id, file);
      this.toast.success('Foto actualizada');
      await this.reload();
      // Refresh the selected reference so the new avatar appears in the panel.
      const fresh = this.employees().find((e) => e.id === emp.id);
      if (fresh) this.selected.set(fresh);
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail ?? 'No pudimos subir la foto';
      this.toast.error(msg);
    } finally {
      // Clear the input so picking the same file again fires `change`.
      input.value = '';
    }
  }

  avatarBg(id: string): string {
    // Pastel-ish — high lightness + moderate saturation gives a soft fill
    // that pairs well with dark initials on top. Hue is hashed so each user
    // gets a stable but different color.
    return `hsl(${hashHue(id)}, 55%, 88%)`;
  }

  avatarFg(id: string): string {
    // Matching deeper tone for the initials/text inside the pastel circle.
    return `hsl(${hashHue(id)}, 35%, 35%)`;
  }

  roleBadgeClass(role: string): string {
    // Soft pastel chips — same palette family as the avatars.
    if (role === 'owner') return 'bg-violet-50 text-violet-700 border border-violet-100';
    if (role === 'admin') return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
    if (role === 'guest') return 'bg-slate-50 text-slate-500 border border-slate-200';
    return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
  }
}
