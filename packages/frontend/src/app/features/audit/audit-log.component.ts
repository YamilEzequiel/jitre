import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe, JsonPipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';
import { ToastService } from '../../core/toast/toast.service';

interface AuditLogEntry {
  id: string;
  workspaceId: string;
  actorUserId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Audit log viewer for workspace admins. Compliance / forensic / "who changed
 * what" UI. Backed by /api/v1/audit-logs which is already admin-gated server
 * side; we also bounce non-admins client side for a nicer UX.
 */
@Component({
  selector: 'jt-audit-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe],
  template: `
    <div class="max-w-7xl space-y-6">
      <header class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
        <div class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
          <i class="pi pi-shield text-violet-600" aria-hidden="true"></i>
          <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Auditoría</span>
        </div>
        <h1 class="mt-3 text-3xl font-black tracking-tight bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
          Audit log
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Cambios sensibles del workspace · {{ total() }} eventos
        </p>
      </header>

      <section class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        @if (loading()) {
          <p class="px-4 py-8 text-center text-sm text-slate-400">Cargando…</p>
        } @else if (items().length === 0) {
          <p class="px-4 py-8 text-center text-sm text-slate-400 italic">Sin eventos.</p>
        } @else {
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th class="px-4 py-3 text-left font-bold">Cuándo</th>
                <th class="px-4 py-3 text-left font-bold">Actor</th>
                <th class="px-4 py-3 text-left font-bold">Acción</th>
                <th class="px-4 py-3 text-left font-bold">Sujeto</th>
                <th class="px-4 py-3 text-left font-bold">Cambios</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of items(); track entry.id) {
                <tr class="border-t border-slate-100 align-top">
                  <td class="px-4 py-3 text-slate-700 tabular-nums whitespace-nowrap">{{ entry.createdAt | date:'short' }}</td>
                  <td class="px-4 py-3 text-slate-700 truncate max-w-[14rem]">{{ actorName(entry.actorUserId) }}</td>
                  <td class="px-4 py-3">
                    <span class="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">{{ entry.action }}</span>
                  </td>
                  <td class="px-4 py-3 text-slate-600">
                    <span class="font-mono text-[11px]">{{ entry.subjectType }}</span>
                    <span class="ml-1 text-[10px] text-slate-400">#{{ shortId(entry.subjectId) }}</span>
                  </td>
                  <td class="px-4 py-3">
                    @if (entry.diff) {
                      <details class="text-xs">
                        <summary class="cursor-pointer text-violet-700 font-semibold">ver diff</summary>
                        <pre class="mt-2 max-w-md overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">{{ entry.diff | json }}</pre>
                      </details>
                    } @else {
                      <span class="text-[11px] text-slate-400">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <footer class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <span>Página {{ page() }} · {{ items().length }} de {{ total() }}</span>
            <div class="flex gap-1">
              <button type="button" (click)="prev()" [disabled]="page() <= 1"
                      class="rounded px-2 py-1 hover:bg-white disabled:opacity-50">‹ Anterior</button>
              <button type="button" (click)="next()" [disabled]="!hasMore()"
                      class="rounded px-2 py-1 hover:bg-white disabled:opacity-50">Siguiente ›</button>
            </div>
          </footer>
        }
      </section>
    </div>
  `,
})
export class AuditLogComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly memberStore = inject(WorkspaceMemberStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly items = signal<AuditLogEntry[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(50);
  readonly loading = signal(false);

  readonly hasMore = computed(() => this.page() * this.pageSize() < this.total());

  async ngOnInit(): Promise<void> {
    if (this.auth.currentUser()?.role !== 'admin') {
      void this.router.navigateByUrl('/');
      return;
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const params = new HttpParams()
        .set('page', this.page())
        .set('pageSize', this.pageSize());
      const res = await firstValueFrom(
        this.http.get<Page<AuditLogEntry>>('/api/v1/audit-logs', { params }),
      );
      this.items.set(res.items ?? []);
      this.total.set(res.total ?? 0);
    } catch {
      this.toast.error('No pudimos cargar el audit log');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async prev(): Promise<void> {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    await this.load();
  }

  async next(): Promise<void> {
    if (!this.hasMore()) return;
    this.page.update((p) => p + 1);
    await this.load();
  }

  actorName(actorId: string | null): string {
    if (!actorId) return 'Sistema';
    return this.memberStore.displayNameFor(actorId, this.shortId(actorId));
  }

  shortId(id: string): string {
    return id ? id.slice(0, 6) : '—';
  }
}
