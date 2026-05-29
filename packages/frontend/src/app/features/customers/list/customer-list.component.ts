import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Customer,
  CustomerApiService,
} from '../../../stores/customer-api.service';
import { CustomerStore } from '../../../stores/customer.store';
import { ProjectStore } from '../../../stores/project.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';

type StatusFilter = 'all' | 'active' | 'archived';

const DEFAULT_COLOR = '#2563eb';

/**
 * Curated palette of swatches that pair well with the workspace theme.
 * Order intentionally walks a hue circle so adjacent customers in the picker
 * feel visually distinct.
 */
const PALETTE = [
  '#2563eb', // blue-600 (default)
  '#7c3aed', // violet-600
  '#4f46e5', // indigo-600
  '#0891b2', // cyan-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#a21caf', // fuchsia-700
  '#475569', // slate-600
] as const;

function isPrimeicon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return icon.trim().startsWith('pi-');
}

interface IconOption {
  pi: string;
  keywords: string;
}
const ICON_OPTIONS: readonly IconOption[] = [
  { pi: 'pi-building', keywords: 'edificio empresa office building' },
  { pi: 'pi-building-columns', keywords: 'banco gobierno institución' },
  { pi: 'pi-briefcase', keywords: 'negocio business' },
  { pi: 'pi-users', keywords: 'equipo team people' },
  { pi: 'pi-id-card', keywords: 'identificación cliente' },
  { pi: 'pi-shopping-cart', keywords: 'compras retail ecommerce' },
  { pi: 'pi-shop', keywords: 'tienda comercio shop store' },
  { pi: 'pi-globe', keywords: 'internacional web global' },
  { pi: 'pi-dollar', keywords: 'finanzas finance dinero' },
  { pi: 'pi-credit-card', keywords: 'pagos billing payments' },
  { pi: 'pi-heart', keywords: 'salud favorito' },
  { pi: 'pi-star', keywords: 'destacado featured top' },
  { pi: 'pi-trophy', keywords: 'premium vip' },
  { pi: 'pi-megaphone', keywords: 'marketing ads' },
  { pi: 'pi-truck', keywords: 'logística shipping' },
  { pi: 'pi-warehouse', keywords: 'depósito almacén warehouse' },
  { pi: 'pi-server', keywords: 'tecnología tech' },
  { pi: 'pi-code', keywords: 'desarrollo code' },
];

@Component({
  selector: 'jt-customer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <div class="flex flex-col h-full max-w-7xl">
      <!-- Header -->
      <header class="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div class="space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-200 bg-blue-50">
            <i class="pi pi-id-card text-blue-600 text-[11px]" aria-hidden="true"></i>
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Workspace · Clientes
            </span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black tracking-tight">
            <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
              Clientes
            </span>
          </h1>
          <p class="text-sm text-slate-500">
            {{ customers().length }} clientes · usados para atribuir proyectos a una empresa externa.
          </p>
        </div>
        @if (canManage()) {
          <button type="button"
                  (click)="openCreate()"
                  class="group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white
                         bg-gradient-to-r from-indigo-600 to-violet-600
                         shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/40
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-shadow">
            <i class="pi pi-plus text-xs" aria-hidden="true"></i>
            Nuevo cliente
          </button>
        }
      </header>

      <!-- Status filter chips -->
      <div class="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filtrar por estado">
        @for (s of statusOptions; track s.value) {
          <button
            [class]="
              'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ' +
              (statusFilter() === s.value
                ? 'text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/25 border border-transparent'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-100')
            "
            (click)="statusFilter.set(s.value)"
            [attr.aria-pressed]="statusFilter() === s.value">
            {{ s.label }}
          </button>
        }
      </div>

      <!-- List -->
      @if (loading() && customers().length === 0) {
        <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          <i class="pi pi-spin pi-spinner mr-2" aria-hidden="true"></i>
          Cargando clientes…
        </div>
      } @else if (filteredCustomers().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <span class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <i class="pi pi-id-card text-lg" aria-hidden="true"></i>
          </span>
          <p class="mt-3 text-sm font-bold text-slate-700">Sin clientes</p>
          <p class="mt-1 text-xs text-slate-500">
            Creá el primero para atribuir proyectos a una empresa.
          </p>
        </div>
      } @else {
        <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Lista de clientes">
          @for (customer of filteredCustomers(); track customer.id) {
            <article class="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70 transition hover:border-slate-300 hover:shadow-md"
                     (click)="navigateTo(customer.id)"
                     role="button"
                     tabindex="0"
                     (keydown.enter)="navigateTo(customer.id)"
                     [attr.aria-label]="'Abrir cliente ' + customer.name">
              <div class="h-1.5 w-full" [style.background]="customer.color"></div>
              <div class="space-y-3 p-4">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                          [style.background]="customer.color + '20'"
                          [style.color]="customer.color">
                      @if (isPi(customer.icon)) {
                        <i [class]="'pi ' + customer.icon" aria-hidden="true"></i>
                      } @else if (customer.icon) {
                        <span aria-hidden="true">{{ customer.icon }}</span>
                      } @else {
                        <i class="pi pi-id-card" aria-hidden="true"></i>
                      }
                    </span>
                    <div class="min-w-0">
                      <h3 class="truncate text-sm font-black text-slate-950">{{ customer.name }}</h3>
                      @if (customer.taxId) {
                        <p class="truncate text-[11px] font-mono text-slate-500">{{ customer.taxId }}</p>
                      }
                    </div>
                  </div>
                  <span [class]="
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] border ' +
                    (customer.status === 'active'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                      : 'text-slate-500 bg-slate-50 border-slate-200')
                  ">
                    {{ customer.status === 'active' ? 'Activo' : 'Archivado' }}
                  </span>
                </div>

                @if (customer.email || customer.phone) {
                  <div class="space-y-1 text-[11px] text-slate-600">
                    @if (customer.email) {
                      <p class="flex items-center gap-1.5 truncate">
                        <i class="pi pi-envelope text-slate-400 text-[10px]" aria-hidden="true"></i>
                        {{ customer.email }}
                      </p>
                    }
                    @if (customer.phone) {
                      <p class="flex items-center gap-1.5 truncate">
                        <i class="pi pi-phone text-slate-400 text-[10px]" aria-hidden="true"></i>
                        {{ customer.phone }}
                      </p>
                    }
                  </div>
                }

                <div class="flex items-center justify-between gap-2 pt-1">
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <i class="pi pi-folder text-[10px]" aria-hidden="true"></i>
                    {{ projectCount(customer.id) }} proyecto(s)
                  </span>
                  @if (canManage()) {
                    <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button"
                              (click)="$event.stopPropagation(); openEdit(customer)"
                              class="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700"
                              [attr.aria-label]="'Editar cliente ' + customer.name">
                        <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i>
                      </button>
                      <button type="button"
                              (click)="$event.stopPropagation(); confirmDelete(customer)"
                              class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                              [attr.aria-label]="'Eliminar cliente ' + customer.name">
                        <i class="pi pi-trash text-[11px]" aria-hidden="true"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </article>
          }
        </section>
      }
    </div>

    <!-- Create/Edit dialog -->
    @if (showDialog()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
           role="dialog"
           aria-modal="true"
           (click)="closeDialog()">
        <div class="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
             (click)="$event.stopPropagation()">
          <header class="mb-5 flex items-center justify-between gap-3">
            <h3 class="text-lg font-black text-slate-950">
              {{ editing() ? 'Editar cliente' : 'Nuevo cliente' }}
            </h3>
            <button type="button"
                    (click)="closeDialog()"
                    class="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Cerrar">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </header>

          <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="flex flex-col gap-1 sm:col-span-2">
                <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Nombre <span class="text-rose-500">*</span>
                </span>
                <input type="text"
                       formControlName="name"
                       maxlength="120"
                       placeholder="Acme Corp, Globant SA…"
                       class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                @if (form.controls.name.touched && form.controls.name.invalid) {
                  <span class="text-[11px] text-rose-600">El nombre es obligatorio (máx 120).</span>
                }
              </label>

              <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Email</span>
                <input type="email"
                       formControlName="email"
                       maxlength="180"
                       placeholder="contacto@empresa.com"
                       class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                @if (form.controls.email.touched && form.controls.email.invalid) {
                  <span class="text-[11px] text-rose-600">Email inválido.</span>
                }
              </label>

              <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teléfono</span>
                <input type="tel"
                       formControlName="phone"
                       maxlength="40"
                       placeholder="+54 11 1234-5678"
                       class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
              </label>

              <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">CUIT / VAT / EIN</span>
                <input type="text"
                       formControlName="taxId"
                       maxlength="40"
                       placeholder="30-12345678-9"
                       class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
              </label>

              <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Estado</span>
                <select formControlName="status"
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20">
                  <option value="active">Activo</option>
                  <option value="archived">Archivado</option>
                </select>
              </label>

              <label class="flex flex-col gap-1 sm:col-span-2">
                <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Dirección</span>
                <input type="text"
                       formControlName="address"
                       maxlength="250"
                       placeholder="Av. Corrientes 1234, CABA"
                       class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
              </label>
            </div>

            <fieldset class="flex flex-col gap-2">
              <legend class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Color e icono</legend>
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                      [style.background]="(form.controls.color.value || defaultColor) + '20'"
                      [style.color]="form.controls.color.value || defaultColor">
                  @if (isPi(form.controls.icon.value)) {
                    <i [class]="'pi ' + form.controls.icon.value" aria-hidden="true"></i>
                  } @else if (form.controls.icon.value) {
                    <span aria-hidden="true">{{ form.controls.icon.value }}</span>
                  } @else {
                    <i class="pi pi-id-card" aria-hidden="true"></i>
                  }
                </span>
                <input type="color"
                       formControlName="color"
                       class="h-10 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                       aria-label="Selector de color" />
                <div class="flex flex-wrap gap-1.5">
                  @for (swatch of palette; track swatch) {
                    <button type="button"
                            (click)="form.controls.color.setValue(swatch)"
                            class="h-7 w-7 rounded-full border-2 transition"
                            [class.border-slate-900]="form.controls.color.value === swatch"
                            [class.border-transparent]="form.controls.color.value !== swatch"
                            [style.background]="swatch"
                            [attr.aria-label]="'Usar color ' + swatch"></button>
                  }
                </div>
              </div>
              <div class="grid grid-cols-9 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-2">
                @for (opt of iconOptions; track opt.pi) {
                  <button type="button"
                          (click)="selectIcon(opt.pi)"
                          [title]="opt.pi"
                          [attr.aria-pressed]="form.controls.icon.value === opt.pi"
                          class="flex aspect-square items-center justify-center rounded-lg border text-sm transition focus:outline-none focus:ring-2 focus:ring-violet-300"
                          [class.bg-white]="form.controls.icon.value !== opt.pi"
                          [class.border-slate-200]="form.controls.icon.value !== opt.pi"
                          [class.text-slate-600]="form.controls.icon.value !== opt.pi"
                          [class.hover:border-violet-300]="form.controls.icon.value !== opt.pi"
                          [class.bg-violet-600]="form.controls.icon.value === opt.pi"
                          [class.border-violet-600]="form.controls.icon.value === opt.pi"
                          [class.text-white]="form.controls.icon.value === opt.pi">
                    <i [class]="'pi ' + opt.pi" aria-hidden="true"></i>
                  </button>
                }
              </div>
              @if (form.controls.icon.value) {
                <button type="button"
                        (click)="clearIcon()"
                        class="self-start text-[11px] font-semibold text-slate-500 hover:text-rose-600">
                  Quitar icono
                </button>
              }
            </fieldset>

            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Notas</span>
              <textarea rows="3"
                        formControlName="notes"
                        maxlength="2000"
                        placeholder="Información adicional, contacto interno, particularidades…"
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"></textarea>
            </label>

            @if (errorMessage()) {
              <p class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{{ errorMessage() }}</p>
            }

            <div class="flex items-center justify-end gap-2 pt-2">
              <button type="button"
                      (click)="closeDialog()"
                      class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button type="submit"
                      [disabled]="form.invalid || saving()"
                      class="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                @if (saving()) {
                  <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                  Guardando…
                } @else {
                  <i class="pi pi-check text-xs" aria-hidden="true"></i>
                  Guardar
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete confirmation -->
    @if (pendingDelete(); as victim) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
           role="alertdialog"
           aria-modal="true"
           (click)="cancelDelete()">
        <div class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
             (click)="$event.stopPropagation()">
          <h3 class="text-lg font-black text-slate-950">¿Eliminar el cliente "{{ victim.name }}"?</h3>
          <p class="mt-2 text-sm text-slate-600">
            Los proyectos asignados quedarán sin cliente. Esta acción no se puede deshacer.
          </p>
          <div class="mt-5 flex items-center justify-end gap-2">
            <button type="button"
                    (click)="cancelDelete()"
                    class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button type="button"
                    (click)="performDelete(victim)"
                    [disabled]="deleting()"
                    class="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60">
              @if (deleting()) {
                <i class="pi pi-spin pi-spinner text-xs" aria-hidden="true"></i>
                Eliminando…
              } @else {
                <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                Eliminar
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CustomerListComponent implements OnInit {
  private readonly api = inject(CustomerApiService);
  private readonly store = inject(CustomerStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly palette = PALETTE;
  protected readonly defaultColor = DEFAULT_COLOR;
  protected readonly isPi = isPrimeicon;
  protected readonly iconOptions = ICON_OPTIONS;

  readonly customers = this.store.customers;
  readonly loading = this.store.loading;
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showDialog = signal(false);
  readonly editing = signal<Customer | null>(null);
  readonly pendingDelete = signal<Customer | null>(null);
  readonly statusFilter = signal<StatusFilter>('all');

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'archived', label: 'Archivados' },
  ];

  readonly filteredCustomers = computed<Customer[]>(() => {
    const filter = this.statusFilter();
    const items = this.customers();
    if (filter === 'all') return items;
    return items.filter((c) => c.status === filter);
  });

  readonly canManage = computed(() => {
    const role = this.auth.currentWorkspace()?.role;
    return role === 'owner' || role === 'admin';
  });

  readonly workspaceId = computed(() => this.auth.currentWorkspace()?.id ?? null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    status: ['active' as 'active' | 'archived', [Validators.required]],
    color: [DEFAULT_COLOR, [Validators.required]],
    icon: [''],
    email: ['', [Validators.email, Validators.maxLength(180)]],
    phone: ['', [Validators.maxLength(40)]],
    taxId: ['', [Validators.maxLength(40)]],
    address: ['', [Validators.maxLength(250)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  async ngOnInit(): Promise<void> {
    const workspaceId = this.workspaceId();
    if (!workspaceId) return;
    try {
      await Promise.all([
        this.store.load(workspaceId),
        this.projectStore.onWorkspaceSwitch(workspaceId).catch(() => undefined),
      ]);
    } catch {
      this.toast.error('No pudimos cargar los clientes');
    }
  }

  projectCount(customerId: string): number {
    return (this.projectStore.items() as { customerId?: string | null }[]).filter(
      (p) => p.customerId === customerId,
    ).length;
  }

  navigateTo(id: string): void {
    this.router.navigate(['/customers', id]);
  }

  openCreate(): void {
    if (!this.canManage()) return;
    this.editing.set(null);
    this.errorMessage.set(null);
    this.form.reset({
      name: '',
      status: 'active',
      color: DEFAULT_COLOR,
      icon: '',
      email: '',
      phone: '',
      taxId: '',
      address: '',
      notes: '',
    });
    this.showDialog.set(true);
  }

  openEdit(customer: Customer): void {
    if (!this.canManage()) return;
    this.editing.set(customer);
    this.errorMessage.set(null);
    this.form.reset({
      name: customer.name,
      status: customer.status,
      color: customer.color,
      icon: customer.icon ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      taxId: customer.taxId ?? '',
      address: customer.address ?? '',
      notes: customer.notes ?? '',
    });
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
    this.editing.set(null);
  }

  selectIcon(pi: string): void {
    this.form.controls.icon.setValue(pi);
    this.form.controls.icon.markAsDirty();
  }

  clearIcon(): void {
    this.form.controls.icon.setValue('');
    this.form.controls.icon.markAsDirty();
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    const workspaceId = this.workspaceId();
    if (!workspaceId) {
      this.toast.error('No hay workspace activo');
      return;
    }
    const raw = this.form.getRawValue();
    const baseDto = {
      name: (raw.name ?? '').trim(),
      color: (raw.color ?? DEFAULT_COLOR).trim(),
      icon: this.emptyToNull(raw.icon),
      email: this.emptyToNull(raw.email),
      phone: this.emptyToNull(raw.phone),
      taxId: this.emptyToNull(raw.taxId),
      address: this.emptyToNull(raw.address),
      notes: this.emptyToNull(raw.notes),
    };
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const current = this.editing();
      const saved = current
        ? await this.api.update(workspaceId, current.id, {
            ...baseDto,
            status: raw.status ?? 'active',
          })
        : await this.api.create(workspaceId, baseDto);
      this.store.upsert(saved);
      this.toast.success(current ? 'Cliente actualizado' : 'Cliente creado');
      this.closeDialog();
    } catch (err) {
      const msg =
        (err as { error?: { detail?: string; message?: string } })?.error?.detail ??
        (err as { error?: { message?: string } })?.error?.message ??
        'No pudimos guardar el cliente';
      this.errorMessage.set(
        msg === 'CUSTOMER_NAME_TAKEN' ? 'Ya existe un cliente con ese nombre' : msg,
      );
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(customer: Customer): void {
    if (!this.canManage()) return;
    this.pendingDelete.set(customer);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  async performDelete(customer: Customer): Promise<void> {
    const workspaceId = this.workspaceId();
    if (!workspaceId) return;
    this.deleting.set(true);
    try {
      await this.api.delete(workspaceId, customer.id);
      this.store.remove(customer.id);
      this.toast.success('Cliente eliminado');
      this.pendingDelete.set(null);
    } catch (err) {
      const msg =
        (err as { error?: { detail?: string } })?.error?.detail ??
        'No pudimos eliminar el cliente';
      this.toast.error(msg);
    } finally {
      this.deleting.set(false);
    }
  }

  private emptyToNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
