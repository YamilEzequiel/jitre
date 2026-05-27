import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
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
  imports: [DatePipe],
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
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
                      <button type="button"
                              (click)="openDiff(entry, $event)"
                              class="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400">
                        <i class="pi pi-code text-[10px]" aria-hidden="true"></i>
                        ver diff
                      </button>
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

    @let active = selectedEntry();
    @if (active) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
           role="dialog"
           aria-modal="true"
           aria-labelledby="audit-diff-title"
           (click)="onBackdropClick($event)">
        <div class="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40 ring-1 ring-slate-800"
             (click)="$event.stopPropagation()">
          <header class="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
            <div class="flex items-center gap-1.5">
              <span class="h-3 w-3 rounded-full bg-rose-500/80"></span>
              <span class="h-3 w-3 rounded-full bg-amber-400/80"></span>
              <span class="h-3 w-3 rounded-full bg-emerald-500/80"></span>
            </div>
            <h2 id="audit-diff-title" class="flex-1 truncate text-center font-mono text-[12px] text-slate-300">
              audit · <span class="text-violet-300">{{ active.action }}</span>
            </h2>
            <button #closeBtn type="button"
                    (click)="closeDiff()"
                    aria-label="Cerrar"
                    class="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <i class="pi pi-times text-xs" aria-hidden="true"></i>
            </button>
          </header>

          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b border-slate-800 bg-slate-900/60 px-4 py-3 font-mono text-[11px]">
            <dt class="text-slate-500">actor</dt>
            <dd class="text-slate-200">{{ actorName(active.actorUserId) }}</dd>
            <dt class="text-slate-500">subject</dt>
            <dd class="text-slate-200">{{ active.subjectType }} <span class="text-slate-500">#{{ shortId(active.subjectId) }}</span></dd>
            <dt class="text-slate-500">when</dt>
            <dd class="text-slate-200 tabular-nums">{{ active.createdAt | date:'medium' }}</dd>
          </dl>

          <pre class="max-h-[60vh] overflow-auto bg-slate-950 px-4 py-3 font-mono text-[12px] leading-5 text-slate-200"
               [innerHTML]="highlightedDiff()"></pre>

          <footer class="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900 px-4 py-2.5">
            <button type="button"
                    (click)="copyDiff()"
                    class="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <i class="pi pi-copy text-[10px]" aria-hidden="true"></i>
              Copiar
            </button>
            <button type="button"
                    (click)="closeDiff()"
                    class="rounded-md bg-violet-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400">
              Cerrar
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class AuditLogComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly memberStore = inject(WorkspaceMemberStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  readonly items = signal<AuditLogEntry[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(50);
  readonly loading = signal(false);

  readonly selectedEntry = signal<AuditLogEntry | null>(null);
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  private lastTrigger: HTMLElement | null = null;

  readonly hasMore = computed(() => this.page() * this.pageSize() < this.total());

  readonly highlightedDiff = computed<SafeHtml | null>(() => {
    const entry = this.selectedEntry();
    if (!entry?.diff) return null;
    return this.sanitizer.bypassSecurityTrustHtml(this.buildHighlightedJson(entry.diff));
  });

  constructor() {
    effect((onCleanup) => {
      if (typeof document === 'undefined') return;
      if (this.selectedEntry()) {
        document.body.style.overflow = 'hidden';
        onCleanup(() => {
          document.body.style.overflow = '';
        });
      }
    });
  }

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

  openDiff(entry: AuditLogEntry, ev: Event): void {
    if (!entry.diff) return;
    this.lastTrigger = ev.currentTarget as HTMLElement | null;
    this.selectedEntry.set(entry);
    queueMicrotask(() => this.closeBtn()?.nativeElement.focus());
  }

  closeDiff(): void {
    if (!this.selectedEntry()) return;
    this.selectedEntry.set(null);
    const trigger = this.lastTrigger;
    this.lastTrigger = null;
    queueMicrotask(() => trigger?.focus());
  }

  onEscape(): void {
    if (this.selectedEntry()) this.closeDiff();
  }

  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.closeDiff();
  }

  async copyDiff(): Promise<void> {
    const entry = this.selectedEntry();
    if (!entry?.diff) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry.diff, null, 2));
      this.toast.success('Copiado al portapapeles');
    } catch {
      this.toast.error('No pudimos copiar');
    }
  }

  actorName(actorId: string | null): string {
    if (!actorId) return 'Sistema';
    return this.memberStore.displayNameFor(actorId, this.shortId(actorId));
  }

  shortId(id: string): string {
    return id ? id.slice(0, 6) : '—';
  }

  private buildHighlightedJson(value: Record<string, unknown>): string {
    const json = JSON.stringify(value, null, 2);
    const regex = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    const out: string[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(json)) !== null) {
      if (m.index > lastIndex) {
        out.push(this.escapeHtml(json.slice(lastIndex, m.index)));
      }
      const [match, str, colon, kw] = m;
      if (str) {
        const cls = colon ? 'text-sky-300' : 'text-emerald-300';
        out.push(`<span class="${cls}">${this.escapeHtml(str)}</span>`);
        if (colon) out.push(this.escapeHtml(colon));
      } else if (kw) {
        const cls = kw === 'null' ? 'text-rose-300' : 'text-purple-300';
        out.push(`<span class="${cls}">${kw}</span>`);
      } else {
        out.push(`<span class="text-amber-300">${match}</span>`);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < json.length) {
      out.push(this.escapeHtml(json.slice(lastIndex)));
    }
    const highlighted = out.join('');
    return highlighted
      .split('\n')
      .map((line, i) => {
        const n = String(i + 1).padStart(3, ' ');
        return `<div class="flex"><span class="select-none pr-4 text-right text-slate-600 tabular-nums" aria-hidden="true">${n}</span><span class="flex-1 whitespace-pre">${line || ' '}</span></div>`;
      })
      .join('');
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
