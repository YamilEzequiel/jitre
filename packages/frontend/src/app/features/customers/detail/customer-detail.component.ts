import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Customer,
  CustomerApiService,
} from '../../../stores/customer-api.service';
import { CustomerStore } from '../../../stores/customer.store';
import { ProjectStore } from '../../../stores/project.store';
import { Project } from '../../../stores/project-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';

function isPrimeicon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return icon.trim().startsWith('pi-');
}

@Component({
  selector: 'jt-customer-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (loading() && !customer()) {
      <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        <i class="pi pi-spin pi-spinner mr-2" aria-hidden="true"></i>
        Cargando cliente…
      </div>
    } @else if (customer(); as c) {
      <div class="flex flex-col gap-6 max-w-5xl">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-md"
                  [style.background]="c.color + '20'"
                  [style.color]="c.color">
              @if (isPi(c.icon)) {
                <i [class]="'pi ' + c.icon" aria-hidden="true"></i>
              } @else if (c.icon) {
                <span aria-hidden="true">{{ c.icon }}</span>
              } @else {
                <i class="pi pi-id-card" aria-hidden="true"></i>
              }
            </span>
            <div class="min-w-0">
              <a routerLink="/customers"
                 class="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 hover:text-violet-700">
                <i class="pi pi-arrow-left text-[10px]" aria-hidden="true"></i>
                Clientes
              </a>
              <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 truncate">{{ c.name }}</h1>
              <div class="flex flex-wrap items-center gap-2 mt-1">
                <span [class]="
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] border ' +
                  (c.status === 'active'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    : 'text-slate-500 bg-slate-50 border-slate-200')
                ">
                  {{ c.status === 'active' ? 'Activo' : 'Archivado' }}
                </span>
                @if (c.taxId) {
                  <span class="text-[11px] font-mono text-slate-500">{{ c.taxId }}</span>
                }
              </div>
            </div>
          </div>

          @if (canManage()) {
            <div class="flex gap-2">
              <button type="button"
                      (click)="goBackToList()"
                      class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                <i class="pi pi-pencil text-[11px]" aria-hidden="true"></i>
                Editar
              </button>
              <button type="button"
                      (click)="toggleStatus(c)"
                      [disabled]="updatingStatus()"
                      class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                @if (updatingStatus()) {
                  <i class="pi pi-spin pi-spinner text-[11px]" aria-hidden="true"></i>
                } @else {
                  <i [class]="c.status === 'active' ? 'pi pi-archive text-[11px]' : 'pi pi-check text-[11px]'" aria-hidden="true"></i>
                }
                {{ c.status === 'active' ? 'Archivar' : 'Reactivar' }}
              </button>
            </div>
          }
        </header>

        <!-- Contact info -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-sm font-black uppercase tracking-[0.16em] text-slate-500">Contacto</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Email</p>
              @if (c.email) {
                <a [href]="'mailto:' + c.email"
                   class="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 break-all">
                  <i class="pi pi-envelope text-xs" aria-hidden="true"></i>
                  {{ c.email }}
                </a>
              } @else {
                <p class="mt-1 text-sm text-slate-400 italic">Sin email</p>
              }
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Teléfono</p>
              @if (c.phone) {
                <p class="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <i class="pi pi-phone text-xs text-slate-400" aria-hidden="true"></i>
                  {{ c.phone }}
                </p>
              } @else {
                <p class="mt-1 text-sm text-slate-400 italic">Sin teléfono</p>
              }
            </div>
            <div class="sm:col-span-2">
              <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Dirección</p>
              @if (c.address) {
                <p class="mt-1 text-sm text-slate-900">{{ c.address }}</p>
              } @else {
                <p class="mt-1 text-sm text-slate-400 italic">Sin dirección</p>
              }
            </div>
          </div>
        </section>

        <!-- Notes -->
        @if (c.notes) {
          <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500">Notas</h2>
            <p class="whitespace-pre-wrap text-sm text-slate-700">{{ c.notes }}</p>
          </section>
        }

        <!-- Linked projects -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
              Proyectos ({{ projects().length }})
            </h2>
          </div>
          @if (projects().length === 0) {
            <p class="text-sm text-slate-400 italic">Este cliente todavía no tiene proyectos asignados.</p>
          } @else {
            <ul class="divide-y divide-slate-100">
              @for (p of projects(); track p.id) {
                <li>
                  <a [routerLink]="['/projects', p.id]"
                     class="group flex items-center justify-between gap-3 py-3 transition hover:bg-slate-50 rounded-lg px-2">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                            [style.background]="p.color || '#6d28d9'">
                        @if (isPi(p.icon)) {
                          <i [class]="'pi ' + p.icon" aria-hidden="true"></i>
                        } @else if (p.icon) {
                          <span aria-hidden="true">{{ p.icon }}</span>
                        } @else {
                          <i class="pi pi-folder text-xs" aria-hidden="true"></i>
                        }
                      </span>
                      <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-slate-950 group-hover:text-violet-700">{{ p.name }}</p>
                        <p class="text-[11px] font-mono text-slate-500 truncate">{{ p.key }}</p>
                      </div>
                    </div>
                    <span [class]="
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] border ' +
                      (p.status === 'active'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                        : 'text-slate-500 bg-slate-50 border-slate-200')
                    ">{{ p.status }}</span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>
      </div>
    } @else {
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <p class="text-sm text-slate-500">Cliente no encontrado.</p>
        <a routerLink="/customers" class="mt-3 inline-block text-xs font-semibold text-violet-700 hover:text-violet-900">Volver al listado</a>
      </div>
    }
  `,
})
export class CustomerDetailComponent implements OnInit {
  private readonly api = inject(CustomerApiService);
  private readonly store = inject(CustomerStore);
  private readonly projectStore = inject(ProjectStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isPi = isPrimeicon;

  readonly loading = signal(false);
  readonly updatingStatus = signal(false);
  readonly customerId = signal<string | null>(null);

  readonly customer = computed<Customer | null>(() => {
    const id = this.customerId();
    if (!id) return null;
    return this.store.byId()[id] ?? null;
  });

  readonly projects = computed<Project[]>(() => {
    const id = this.customerId();
    if (!id) return [];
    return (this.projectStore.items() as Project[]).filter(
      (p) => p.customerId === id,
    );
  });

  readonly canManage = computed(() => {
    const role = this.auth.currentWorkspace()?.role;
    return role === 'owner' || role === 'admin';
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/customers']);
      return;
    }
    this.customerId.set(id);
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;

    this.loading.set(true);
    try {
      await Promise.all([
        this.store.load(workspaceId),
        this.projectStore.onWorkspaceSwitch(workspaceId).catch(() => undefined),
      ]);
      // If the customer is not in cache after load, fetch it directly.
      if (!this.store.byId()[id]) {
        const fetched = await this.api.get(workspaceId, id);
        this.store.upsert(fetched);
      }
    } catch {
      this.toast.error('No pudimos cargar el cliente');
    } finally {
      this.loading.set(false);
    }
  }

  goBackToList(): void {
    this.router.navigate(['/customers']);
  }

  async toggleStatus(customer: Customer): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) return;
    this.updatingStatus.set(true);
    try {
      const next = customer.status === 'active' ? 'archived' : 'active';
      const saved = await this.api.update(workspaceId, customer.id, {
        status: next,
      });
      this.store.upsert(saved);
      this.toast.success(
        next === 'archived' ? 'Cliente archivado' : 'Cliente reactivado',
      );
    } catch {
      this.toast.error('No pudimos actualizar el estado');
    } finally {
      this.updatingStatus.set(false);
    }
  }
}
