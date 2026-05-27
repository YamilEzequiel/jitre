import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Area, AreaApiService } from '../../stores/area-api.service';
import { AreaStore } from '../../stores/area.store';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

/**
 * Default colour applied when the admin creates a new area without picking
 * one. Matches the backend default and the workspace's violet-600 accent.
 */
const DEFAULT_COLOR = '#7c3aed';

/**
 * Curated palette of swatches that pair well with the violet/indigo theme.
 * Order intentionally walks a hue circle so adjacent areas in the picker
 * feel visually distinct.
 */
const PALETTE = [
  '#7c3aed', // violet-600
  '#4f46e5', // indigo-600
  '#2563eb', // blue-600
  '#0891b2', // cyan-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#a21caf', // fuchsia-700
  '#475569', // slate-600
] as const;

/** True when the icon string looks like a primeicon class (e.g. `pi-briefcase`). */
function isPrimeicon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return icon.trim().startsWith('pi-');
}

/**
 * Curated subset of PrimeIcons that map well to organizational "areas"
 * (departments, teams, business units). Searchable via the alias keywords.
 */
interface IconOption {
  /** PrimeIcons class without the `pi pi-` prefix — stored as full `pi-X`. */
  pi: string;
  /** Spanish + English keywords for the picker's search. */
  keywords: string;
}
const ICON_OPTIONS: readonly IconOption[] = [
  // Business / ops
  { pi: 'pi-briefcase', keywords: 'negocio business trabajo empresa' },
  { pi: 'pi-building', keywords: 'edificio oficina office building' },
  { pi: 'pi-building-columns', keywords: 'banco gobierno institución bank government' },
  { pi: 'pi-users', keywords: 'equipo personas team people' },
  { pi: 'pi-user', keywords: 'persona usuario user' },
  { pi: 'pi-id-card', keywords: 'identificación rrhh hr empleado' },
  { pi: 'pi-warehouse', keywords: 'depósito almacén warehouse logística' },
  { pi: 'pi-truck', keywords: 'envío logística shipping logistics' },
  { pi: 'pi-box', keywords: 'caja producto product inventory' },
  { pi: 'pi-shopping-cart', keywords: 'compras carrito retail ecommerce' },
  // Tech
  { pi: 'pi-code', keywords: 'código desarrollo development code engineering' },
  { pi: 'pi-server', keywords: 'servidor infraestructura infra server devops' },
  { pi: 'pi-database', keywords: 'base de datos data db' },
  { pi: 'pi-cloud', keywords: 'nube cloud aws azure' },
  { pi: 'pi-desktop', keywords: 'pc computadora desktop it' },
  { pi: 'pi-mobile', keywords: 'móvil celular mobile' },
  { pi: 'pi-globe', keywords: 'internacional web global' },
  // Finance
  { pi: 'pi-dollar', keywords: 'finanzas finance dinero money' },
  { pi: 'pi-money-bill', keywords: 'caja tesorería treasury' },
  { pi: 'pi-credit-card', keywords: 'pagos billing payments' },
  { pi: 'pi-percentage', keywords: 'impuestos taxes' },
  { pi: 'pi-chart-line', keywords: 'analítica analytics' },
  { pi: 'pi-chart-bar', keywords: 'reportes reports kpi' },
  { pi: 'pi-chart-pie', keywords: 'distribución share' },
  { pi: 'pi-receipt', keywords: 'facturación facturas invoice billing' },
  // Marketing / sales
  { pi: 'pi-megaphone', keywords: 'marketing anuncio ads' },
  { pi: 'pi-bullhorn', keywords: 'comunicación pr prensa' },
  { pi: 'pi-tag', keywords: 'producto categoría category' },
  { pi: 'pi-thumbs-up', keywords: 'social media' },
  { pi: 'pi-share-alt', keywords: 'redes networking' },
  // Creative
  { pi: 'pi-palette', keywords: 'diseño design creativo' },
  { pi: 'pi-image', keywords: 'imagen foto media' },
  { pi: 'pi-camera', keywords: 'cámara fotografía photo' },
  { pi: 'pi-video', keywords: 'video produccion' },
  { pi: 'pi-pen-to-square', keywords: 'editor contenido writing content' },
  // HR / education
  { pi: 'pi-graduation-cap', keywords: 'educación training capacitación' },
  { pi: 'pi-book', keywords: 'documentación docs' },
  { pi: 'pi-user-plus', keywords: 'reclutamiento hr hiring' },
  // Ops / security
  { pi: 'pi-cog', keywords: 'configuración operaciones operations settings' },
  { pi: 'pi-wrench', keywords: 'mantenimiento maintenance herramientas' },
  { pi: 'pi-shield', keywords: 'seguridad security compliance' },
  { pi: 'pi-lock', keywords: 'privacidad privacy compliance' },
  { pi: 'pi-key', keywords: 'accesos credentials access' },
  { pi: 'pi-bolt', keywords: 'rendimiento performance energía' },
  // Time / planning
  { pi: 'pi-calendar', keywords: 'agenda planning' },
  { pi: 'pi-clock', keywords: 'tiempo time horas hours' },
  { pi: 'pi-bell', keywords: 'notificaciones alerts' },
  { pi: 'pi-flag', keywords: 'objetivo goal milestone' },
  { pi: 'pi-list-check', keywords: 'tareas tasks checklist' },
  // Files
  { pi: 'pi-file', keywords: 'documento file doc' },
  { pi: 'pi-folder', keywords: 'carpeta folder' },
  { pi: 'pi-inbox', keywords: 'bandeja inbox' },
  { pi: 'pi-envelope', keywords: 'correo email mail' },
  // Healthcare / generic
  { pi: 'pi-heart', keywords: 'salud bienestar health wellness' },
  { pi: 'pi-star', keywords: 'destacado featured' },
  { pi: 'pi-trophy', keywords: 'logros achievements premios' },
  { pi: 'pi-sparkles', keywords: 'ai inteligencia artificial' },
  { pi: 'pi-bullseye', keywords: 'objetivo target meta' },
  { pi: 'pi-th-large', keywords: 'genérico generic' },
];

@Component({
  selector: 'jt-areas-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule],
  host: { class: 'flex flex-col gap-5' },
  template: `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
          <i class="pi pi-th-large text-violet-600 text-[11px]" aria-hidden="true"></i>
          <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Áreas</span>
        </div>
        <h2 class="mt-2 text-xl font-black tracking-tight text-slate-950">Departamentos del workspace</h2>
        <p class="text-xs text-slate-500">
          {{ areas().length }} áreas · usadas para agrupar empleados y proyectos.
        </p>
      </div>
      @if (canManage()) {
        <button type="button"
                (click)="openCreate()"
                class="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition hover:bg-violet-700">
          <i class="pi pi-plus text-[11px]" aria-hidden="true"></i>
          Nueva área
        </button>
      }
    </header>

    @if (loading() && areas().length === 0) {
      <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        <i class="pi pi-spin pi-spinner mr-2" aria-hidden="true"></i>
        Cargando áreas…
      </div>
    } @else if (areas().length === 0) {
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <span class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <i class="pi pi-th-large text-lg" aria-hidden="true"></i>
        </span>
        <p class="mt-3 text-sm font-bold text-slate-700">Sin áreas todavía</p>
        <p class="mt-1 text-xs text-slate-500">
          Creá la primera para organizar empleados y proyectos.
        </p>
      </div>
    } @else {
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Lista de áreas">
        @for (area of areas(); track area.id) {
          <article class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div class="h-1.5 w-full" [style.background]="area.color"></div>
            <div class="space-y-2 p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                        [style.background]="area.color + '20'"
                        [style.color]="area.color">
                    @if (isPi(area.icon)) {
                      <i [class]="'pi ' + area.icon" aria-hidden="true"></i>
                    } @else if (area.icon) {
                      <span aria-hidden="true">{{ area.icon }}</span>
                    } @else {
                      <i class="pi pi-th-large" aria-hidden="true"></i>
                    }
                  </span>
                  <h3 class="truncate text-sm font-black text-slate-950">{{ area.name }}</h3>
                </div>
                @if (canManage()) {
                  <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button"
                            (click)="openEdit(area)"
                            class="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700"
                            [attr.aria-label]="'Editar área ' + area.name">
                      <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i>
                    </button>
                    <button type="button"
                            (click)="confirmDelete(area)"
                            class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                            [attr.aria-label]="'Eliminar área ' + area.name">
                      <i class="pi pi-trash text-[11px]" aria-hidden="true"></i>
                    </button>
                  </div>
                }
              </div>
              @if (area.description) {
                <p class="line-clamp-2 text-xs text-slate-500">{{ area.description }}</p>
              } @else {
                <p class="text-xs text-slate-400 italic">Sin descripción.</p>
              }
            </div>
          </article>
        }
      </section>
    }

    <!-- Create/Edit dialog -->
    @if (showDialog()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
           role="dialog"
           aria-modal="true"
           (click)="closeDialog()">
        <div class="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
             (click)="$event.stopPropagation()">
          <header class="mb-5 flex items-center justify-between gap-3">
            <h3 class="text-lg font-black text-slate-950">
              {{ editing() ? 'Editar área' : 'Nueva área' }}
            </h3>
            <button type="button"
                    (click)="closeDialog()"
                    class="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Cerrar">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </header>

          <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Nombre <span class="text-rose-500">*</span></span>
              <input type="text"
                     formControlName="name"
                     maxlength="80"
                     placeholder="Tecnología, Marketing, Operaciones…"
                     class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
              @if (form.controls.name.touched && form.controls.name.invalid) {
                <span class="text-[11px] text-rose-600">El nombre es obligatorio (máx 80).</span>
              }
            </label>

            <fieldset class="flex flex-col gap-2">
              <legend class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Color</legend>
              <div class="flex items-center gap-2">
                <input type="color"
                       formControlName="color"
                       class="h-10 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                       aria-label="Selector nativo de color" />
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
            </fieldset>

            <fieldset class="flex flex-col gap-2 border-0 p-0">
              <legend class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Icono</legend>

              <div class="flex items-center gap-2">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                      [style.background]="(form.controls.color.value || defaultColor) + '20'"
                      [style.color]="form.controls.color.value || defaultColor">
                  @if (isPi(form.controls.icon.value)) {
                    <i [class]="'pi ' + form.controls.icon.value" aria-hidden="true"></i>
                  } @else if (form.controls.icon.value) {
                    <span aria-hidden="true">{{ form.controls.icon.value }}</span>
                  } @else {
                    <i class="pi pi-th-large" aria-hidden="true"></i>
                  }
                </span>

                <div class="flex flex-1 items-center gap-2">
                  <input type="search"
                         [ngModel]="iconSearch()"
                         (ngModelChange)="iconSearch.set($event)"
                         [ngModelOptions]="{ standalone: true }"
                         placeholder="Buscar icono…"
                         class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                  @if (form.controls.icon.value) {
                    <button type="button"
                            (click)="clearIcon()"
                            class="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-500 hover:border-rose-300 hover:text-rose-600"
                            aria-label="Quitar icono">
                      <i class="pi pi-times text-[10px]" aria-hidden="true"></i>
                      Quitar
                    </button>
                  }
                </div>
              </div>

              <div class="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                @if (filteredIcons().length === 0) {
                  <p class="px-2 py-3 text-center text-[11px] text-slate-400">Sin resultados para "{{ iconSearch() }}"</p>
                } @else {
                  <div class="grid grid-cols-8 gap-1">
                    @for (opt of filteredIcons(); track opt.pi) {
                      <button type="button"
                              (click)="selectIcon(opt.pi)"
                              [title]="opt.pi"
                              [attr.aria-label]="opt.pi"
                              [attr.aria-pressed]="form.controls.icon.value === opt.pi"
                              class="flex aspect-square items-center justify-center rounded-lg border text-sm transition focus:outline-none focus:ring-2 focus:ring-violet-300"
                              [class.bg-white]="form.controls.icon.value !== opt.pi"
                              [class.border-slate-200]="form.controls.icon.value !== opt.pi"
                              [class.text-slate-600]="form.controls.icon.value !== opt.pi"
                              [class.hover:border-violet-300]="form.controls.icon.value !== opt.pi"
                              [class.hover:text-violet-700]="form.controls.icon.value !== opt.pi"
                              [class.bg-violet-600]="form.controls.icon.value === opt.pi"
                              [class.border-violet-600]="form.controls.icon.value === opt.pi"
                              [class.text-white]="form.controls.icon.value === opt.pi"
                              [class.shadow-md]="form.controls.icon.value === opt.pi">
                        <i [class]="'pi ' + opt.pi" aria-hidden="true"></i>
                      </button>
                    }
                  </div>
                }
              </div>

              <span class="text-[10px] text-slate-400">
                Elegí un icono de la grilla. Buscá por nombre (briefcase, code, calendar…) o categoría.
              </span>
            </fieldset>

            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Descripción</span>
              <textarea rows="3"
                        formControlName="description"
                        maxlength="500"
                        placeholder="Para qué sirve esta área, quiénes la integran…"
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
          <h3 class="text-lg font-black text-slate-950">¿Eliminar el área "{{ victim.name }}"?</h3>
          <p class="mt-2 text-sm text-slate-600">
            Los empleados y proyectos asignados quedarán sin área. Esta acción no
            se puede deshacer.
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
export class AreasManagerComponent implements OnInit {
  private readonly api = inject(AreaApiService);
  private readonly store = inject(AreaStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly palette = PALETTE;
  protected readonly defaultColor = DEFAULT_COLOR;
  protected readonly isPi = isPrimeicon;

  readonly areas = this.store.areas;
  readonly loading = this.store.loading;
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showDialog = signal(false);
  readonly editing = signal<Area | null>(null);
  readonly pendingDelete = signal<Area | null>(null);

  readonly canManage = computed(() => {
    const role = this.auth.currentWorkspace()?.role;
    return role === 'owner' || role === 'admin';
  });

  /** Search query for the inline icon picker. Doubles as an emoji input —
   *  when the user types a non-ascii single grapheme it's stored as-is. */
  readonly iconSearch = signal('');
  protected readonly iconOptions = ICON_OPTIONS;
  readonly filteredIcons = computed(() => {
    const q = this.iconSearch().trim().toLowerCase();
    if (!q) return ICON_OPTIONS;
    return ICON_OPTIONS.filter(
      (o) => o.pi.includes(q) || o.keywords.includes(q),
    );
  });

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    color: [DEFAULT_COLOR, [Validators.required]],
    icon: [''],
    description: ['', [Validators.maxLength(500)]],
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;
    try {
      await this.store.load(workspaceId);
    } catch {
      this.toast.error('No pudimos cargar las áreas');
    }
  }

  openCreate(): void {
    if (!this.canManage()) return;
    this.editing.set(null);
    this.errorMessage.set(null);
    this.form.reset({
      name: '',
      color: DEFAULT_COLOR,
      icon: '',
      description: '',
    });
    this.showDialog.set(true);
  }

  openEdit(area: Area): void {
    if (!this.canManage()) return;
    this.editing.set(area);
    this.errorMessage.set(null);
    this.form.reset({
      name: area.name,
      color: area.color,
      icon: area.icon ?? '',
      description: area.description ?? '',
    });
    this.iconSearch.set('');
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
    this.editing.set(null);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) {
      this.toast.error('No hay workspace activo');
      return;
    }
    const raw = this.form.getRawValue();
    const dto = {
      name: (raw.name ?? '').trim(),
      color: (raw.color ?? DEFAULT_COLOR).trim(),
      icon: this.emptyToNull(raw.icon),
      description: this.emptyToNull(raw.description),
    };
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const current = this.editing();
      const saved = current
        ? await this.api.update(workspaceId, current.id, dto)
        : await this.api.create(workspaceId, dto);
      this.store.upsert(saved);
      this.toast.success(current ? 'Área actualizada' : 'Área creada');
      this.closeDialog();
    } catch (err) {
      const msg = (err as { error?: { detail?: string; message?: string } })?.error?.detail
        ?? (err as { error?: { message?: string } })?.error?.message
        ?? 'No pudimos guardar el área';
      this.errorMessage.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(area: Area): void {
    if (!this.canManage()) return;
    this.pendingDelete.set(area);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  selectIcon(pi: string): void {
    this.form.controls.icon.setValue(pi);
    this.form.controls.icon.markAsDirty();
  }

  clearIcon(): void {
    this.form.controls.icon.setValue('');
    this.form.controls.icon.markAsDirty();
    this.iconSearch.set('');
  }

  async performDelete(area: Area): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;
    this.deleting.set(true);
    try {
      await this.api.delete(workspaceId, area.id);
      this.store.remove(area.id);
      this.toast.success('Área eliminada');
      this.pendingDelete.set(null);
    } catch (err) {
      const msg = (err as { error?: { detail?: string } })?.error?.detail
        ?? 'No pudimos eliminar el área';
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
