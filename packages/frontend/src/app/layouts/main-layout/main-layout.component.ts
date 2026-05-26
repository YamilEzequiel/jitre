import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { KeyboardShortcutService } from '../../core/keyboard/keyboard-shortcut.service';
import { CommandPaletteService } from '../../shared/command-palette/command-palette.service';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { ToastContainerComponent } from '../../shared/toast/toast-container.component';
import { CommandPaletteComponent } from '../../shared/command-palette/command-palette.component';
import { AuthService } from '../../core/auth/auth.service';
import { TimeEntryStore } from '../../stores/time-entry.store';
import { TaskStore } from '../../stores/task.store';
import { ToastService } from '../../core/toast/toast.service';
import { formatTimerSeconds } from '../../features/time-tracking/duration.util';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  badge?: 'chat';
}

@Component({
  selector: 'jt-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToastContainerComponent,
    CommandPaletteComponent,
  ],
  template: `
    <div class="relative flex h-screen overflow-hidden bg-[#f7f8fc] text-slate-950">
      <div
        class="pointer-events-none absolute -top-40 left-1/3 w-[60rem] h-[36rem] rounded-full blur-3xl
               bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute top-1/3 -right-32 w-[26rem] h-[26rem] rounded-full blur-3xl
               bg-cyan-500/10"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-40 -left-20 w-[34rem] h-[34rem] rounded-full blur-3xl
               bg-violet-600/15"
        aria-hidden="true"
      ></div>

      <nav
        class="relative hidden w-[13.5rem] shrink-0 flex-col border-r border-white/[0.06]
               bg-[#070b1f] text-white md:flex"
        aria-label="Main navigation"
      >
        <a routerLink="/" class="flex items-center gap-2.5 px-5 pb-5 pt-5">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg
                   bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-violet-600/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-white"
              aria-hidden="true"
            >
              <path d="M9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <span class="min-w-0">
            <span class="block text-base font-black tracking-tight text-white">Jitre</span>
            <span class="block text-[8px] font-bold uppercase tracking-[0.17em] text-slate-500">Plan and ship</span>
          </span>
        </a>

        <div class="mx-4 mb-4 rounded-lg border border-white/[0.07] bg-white/[0.04] p-3">
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
              <i class="pi pi-sparkles text-xs" aria-hidden="true"></i>
            </span>
            <div class="min-w-0">
              <p class="truncate text-xs font-bold text-white">Product team</p>
              <p class="truncate text-[9px] font-semibold text-emerald-400">● Active workspace</p>
            </div>
          </div>
        </div>

        <ul class="flex-1 space-y-1 px-3">
          @for (item of primaryNav(); track item.route) {
            <li>
              <a
                [routerLink]="item.route"
                routerLinkActive="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/30"
                [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                class="group flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <i [class]="'pi ' + item.icon + ' text-[12px] text-violet-300 group-hover:text-white'" aria-hidden="true"></i>
                <span class="flex-1 truncate">{{ item.label }}</span>
                @if (item.badge === 'chat' && chatUnread() > 0) {
                  <span class="rounded-full bg-indigo-400 px-1.5 py-0.5 text-[9px] font-bold text-white">{{ chatUnread() }}</span>
                }
              </a>
            </li>
          }
        </ul>

        <div class="space-y-1 border-t border-white/[0.06] px-3 py-4">
          @for (item of footerNav; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-white/[0.07] text-white"
              class="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              <i [class]="'pi ' + item.icon + ' text-[12px]'" aria-hidden="true"></i>
              {{ item.label }}
            </a>
          }
        </div>
      </nav>

      <div class="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <header
          class="relative flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 text-slate-700 sm:px-6"
        >
          <button
            type="button"
            (click)="openCommandPalette()"
            class="inline-flex min-w-[22rem] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5
                   text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                   focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                   transition-colors"
            aria-label="Open command palette"
          >
            <svg
              class="h-3.5 w-3.5 text-slate-400"
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
            Search commands...
            <kbd
              class="ml-2 inline-flex items-center gap-0.5 rounded
                     border border-slate-200 bg-white px-1.5 py-0.5
                     text-[10px] font-semibold text-slate-400"
            >
              ⌘K
            </kbd>
          </button>

          <div class="flex items-center gap-4">
          @if (activeTimer(); as t) {
            <div
              class="inline-flex items-center gap-2 px-2 py-1 rounded-full
                     border border-emerald-200 bg-emerald-50 text-emerald-700"
              data-testid="active-timer-pill"
              role="status"
              aria-label="Active timer"
            >
              <span
                class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                aria-hidden="true"
              ></span>
              <span class="text-xs font-bold tabular-nums">{{ timerLabel() }}</span>
              <button
                type="button"
                (click)="goToTimerTask()"
                class="max-w-[14rem] truncate text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                [attr.aria-label]="'Go to task ' + (activeTaskTitle() ?? t.taskId)"
              >
                {{ activeTaskTitle() ?? 'Tracking task' }}
              </button>
              <button
                type="button"
                (click)="stopTimer()"
                [disabled]="stopping()"
                class="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5
                       border border-rose-200 bg-rose-50 text-rose-600
                       hover:bg-rose-100 transition-colors disabled:opacity-60"
                aria-label="Stop timer"
              >
                <span class="pi pi-stop-circle" aria-hidden="true"></span>
                Stop
              </button>
            </div>
          }
            <a routerLink="/notifications" aria-label="Notifications" class="text-slate-400 transition hover:text-indigo-600">
              <i class="pi pi-bell text-sm" aria-hidden="true"></i>
            </a>
            <button type="button" aria-label="Help" class="text-slate-400 transition hover:text-indigo-600">
              <i class="pi pi-question-circle text-sm" aria-hidden="true"></i>
            </button>
            <span class="h-8 w-8 rounded-full bg-gradient-to-br from-[#11162e] to-[#15363a]" aria-label="Account"></span>
          </div>
        </header>

        <main
          class="relative flex-1 overflow-auto bg-[#f8faff] p-4 text-slate-950 sm:p-5 lg:p-6"
          id="main-content"
        >
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <jt-toast-container></jt-toast-container>
    <jt-command-palette></jt-command-palette>
  `,
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly shortcuts = inject(KeyboardShortcutService);
  private readonly palette = inject(CommandPaletteService);
  private readonly chatChannelStore = inject(ChatChannelStore);
  private readonly auth = inject(AuthService);
  private readonly timeStore = inject(TimeEntryStore);
  private readonly taskStore = inject(TaskStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly chatUnread = this.chatChannelStore.totalUnread;

  private _unregisterCmdK?: () => void;
  private _unregisterHelp?: () => void;
  private _tickHandle?: ReturnType<typeof setInterval>;

  readonly stopping = signal(false);
  readonly nowMs = signal<number>(Date.now());

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly activeTimer = computed(() => this.timeStore.activeTimer());
  readonly primaryNav = computed<NavItem[]>(() => [
    { label: 'Dashboard', route: '/', icon: 'pi-th-large', exact: true },
    { label: 'Projects', route: '/projects', icon: 'pi-folder' },
    { label: 'AI Insights', route: '/analytics', icon: 'pi-lightbulb' },
    { label: 'Automations', route: '/my-time', icon: 'pi-sliders-h' },
    { label: 'Tickets', route: '/tickets', icon: 'pi-exclamation-circle' },
    { label: 'Docs', route: '/docs', icon: 'pi-file' },
    { label: 'Chat', route: '/chat', icon: 'pi-comments', badge: 'chat' },
    ...(this.isAdmin()
      ? [{ label: 'Time Reports', route: '/time-reports', icon: 'pi-chart-bar' }]
      : []),
  ]);
  readonly footerNav: NavItem[] = [
    { label: 'Settings', route: '/settings', icon: 'pi-cog' },
    { label: 'Support', route: '/docs', icon: 'pi-question-circle' },
  ];

  readonly timerLabel = computed(() => {
    const t = this.activeTimer();
    if (!t || !t.startedAt) return '0:00:00';
    const startedMs = new Date(t.startedAt).getTime();
    const seconds = Math.max(0, Math.floor((this.nowMs() - startedMs) / 1000));
    return formatTimerSeconds(seconds);
  });

  readonly activeTaskTitle = computed<string | null>(() => {
    const t = this.activeTimer();
    if (!t) return null;
    const byId = this.taskStore.byId() as Record<string, { title?: string }>;
    return byId[t.taskId]?.title ?? null;
  });

  ngOnInit(): void {
    this._unregisterCmdK = this.shortcuts.register({
      key: 'cmd+k',
      handler: () => this.palette.open(),
      context: 'Global',
    });
    this._unregisterHelp = this.shortcuts.register({
      key: '?',
      handler: () => {
        // Help overlay handled by ShortcutHelpOverlayComponent visibility toggle
      },
      context: 'Global',
    });
    void this.timeStore.loadActiveTimer();
    this._tickHandle = setInterval(() => this.nowMs.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    this._unregisterCmdK?.();
    this._unregisterHelp?.();
    if (this._tickHandle) clearInterval(this._tickHandle);
  }

  openCommandPalette(): void {
    this.palette.open();
  }

  goToTimerTask(): void {
    const t = this.activeTimer();
    if (!t) return;
    void this.router.navigate(['/tasks', t.taskId]);
  }

  async stopTimer(): Promise<void> {
    this.stopping.set(true);
    try {
      await this.timeStore.stop();
      this.toast.success('Timer stopped');
    } catch {
      this.toast.error('Failed to stop timer');
    } finally {
      this.stopping.set(false);
    }
  }
}
