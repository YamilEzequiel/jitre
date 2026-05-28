import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Subscription } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { KeyboardShortcutService } from '../../core/keyboard/keyboard-shortcut.service';
import { CommandPaletteService } from '../../shared/command-palette/command-palette.service';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { ToastContainerComponent } from '../../shared/toast/toast-container.component';
import { CommandPaletteComponent } from '../../shared/command-palette/command-palette.component';
import { AiCreateDialogComponent } from '../../features/ai-create/ai-create-dialog.component';
import { AiCreateService } from '../../features/ai-create/ai-create.service';
import { AuthService } from '../../core/auth/auth.service';
import { TimeEntryStore } from '../../stores/time-entry.store';
import { TaskStore } from '../../stores/task.store';
import { ToastService } from '../../core/toast/toast.service';
import { formatTimerSeconds } from '../../features/time-tracking/duration.util';
import { LocaleService, SUPPORTED_LOCALES, SupportedLocale } from '../../core/i18n/locale.service';
import { APP_VERSION, REPO_URL } from '../../core/app-info';

interface NavItem {
  labelKey: string;
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
    AiCreateDialogComponent,
    TranslatePipe,
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

      @if (mobileNavOpen()) {
        <!-- Mobile drawer backdrop. Tap closes. -->
        <button
          type="button"
          class="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm md:hidden"
          (click)="closeMobileNav()"
          aria-label="Close menu"
        ></button>
      }

      <nav
        class="fixed inset-y-0 left-0 z-40 flex w-[13.5rem] shrink-0 flex-col border-r border-white/[0.06]
               bg-[#070b1f] text-white transition-transform duration-200 ease-out
               md:relative md:translate-x-0 md:flex"
        [class.translate-x-0]="mobileNavOpen()"
        [class.-translate-x-full]="!mobileNavOpen()"
        [attr.aria-label]="'nav.dashboard' | translate"
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
            <span class="block text-[8px] font-bold uppercase tracking-[0.17em] text-slate-500">{{ 'layout.brandTagline' | translate }}</span>
          </span>
        </a>

        <div class="relative mx-4 mb-4">
          <button
            type="button"
            (click)="toggleWorkspaceMenu($event)"
            [attr.aria-expanded]="workspaceMenuOpen()"
            class="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.04] p-3 transition hover:bg-white/[0.07]"
          >
            <span class="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/15 text-violet-300 shrink-0">
              <i class="pi pi-sparkles text-xs" aria-hidden="true"></i>
            </span>
            <div class="min-w-0 flex-1 text-left">
              <p class="truncate text-xs font-bold text-white">{{ currentWorkspaceName() }}</p>
              <p class="truncate text-[9px] font-semibold text-emerald-400">● {{ 'layout.activeWorkspace' | translate }}</p>
            </div>
            <i class="pi pi-angle-down text-[10px] text-slate-400 shrink-0" aria-hidden="true"></i>
          </button>
          @if (workspaceMenuOpen()) {
            <button type="button" class="fixed inset-0 z-30 cursor-default bg-transparent" (click)="closeWorkspaceMenu()" aria-label="Close workspaces"></button>
            <div class="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-white/10 bg-[#0a0f24] py-1 shadow-2xl">
              <p class="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspaces</p>
              @for (ws of availableWorkspaces(); track ws.id) {
                <button
                  type="button"
                  (click)="switchWorkspace(ws)"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full"
                        [class.bg-emerald-400]="ws.id === currentWorkspaceId()"
                        [class.bg-slate-600]="ws.id !== currentWorkspaceId()"></span>
                  <span class="truncate flex-1">{{ ws.name }}</span>
                  @if (ws.id === currentWorkspaceId()) {
                    <i class="pi pi-check text-[10px] text-emerald-400" aria-hidden="true"></i>
                  }
                </button>
              } @empty {
                <p class="px-3 py-2 text-xs italic text-slate-500">Sin workspaces.</p>
              }
            </div>
          }
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
                <span class="flex-1 truncate">{{ item.labelKey | translate }}</span>
                @if (item.badge === 'chat' && chatUnread() > 0) {
                  <span class="rounded-full bg-indigo-400 px-1.5 py-0.5 text-[9px] font-bold text-white">{{ chatUnread() }}</span>
                }
              </a>
            </li>
          }
        </ul>

        <div class="space-y-1 border-t border-white/[0.06] px-3 py-3">
          @for (item of footerNav; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-white/[0.07] text-white"
              class="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              <i [class]="'pi ' + item.icon + ' text-[12px]'" aria-hidden="true"></i>
              {{ item.labelKey | translate }}
            </a>
          }
          <a
            routerLink="/changelog"
            routerLinkActive="bg-white/[0.07] text-white"
            class="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            <i class="pi pi-history text-[12px]" aria-hidden="true"></i>
            {{ 'nav.changelog' | translate }}
          </a>
          <a
            routerLink="/license"
            routerLinkActive="bg-white/[0.07] text-white"
            class="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            <i class="pi pi-file text-[12px]" aria-hidden="true"></i>
            {{ 'nav.license' | translate }}
          </a>
        </div>

        <div class="border-t border-white/[0.06] px-4 py-3">
          <div class="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <a
              [href]="repoUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 transition hover:text-white"
              aria-label="Open Jitre on GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.57.11.78-.25.78-.55v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.45.11-3.03 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.74.11 3.03.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/>
              </svg>
              GitHub
            </a>
            <a
              routerLink="/changelog"
              class="font-mono tracking-tight text-slate-400 transition hover:text-white"
              [attr.aria-label]="'Current version v' + appVersion"
            >
              v{{ appVersion }}
            </a>
          </div>
        </div>
      </nav>

      <div class="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <header
          class="relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 text-slate-700 sm:px-6"
        >
          <!-- Hamburger — only shows below md, opens the mobile drawer. -->
          <button
            type="button"
            (click)="toggleMobileNav()"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            [attr.aria-label]="mobileNavOpen() ? 'Close menu' : 'Open menu'"
            [attr.aria-expanded]="mobileNavOpen()"
          >
            <i [class]="'pi text-base ' + (mobileNavOpen() ? 'pi-times' : 'pi-bars')" aria-hidden="true"></i>
          </button>

          <button
            type="button"
            (click)="openCommandPalette()"
            class="inline-flex flex-1 sm:min-w-[22rem] sm:flex-none items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5
                   text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                   focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                   transition-colors"
            [attr.aria-label]="'layout.openCommandPalette' | translate"
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
            {{ 'layout.searchCommands' | translate }}
            <kbd
              class="ml-2 inline-flex items-center gap-0.5 rounded
                     border border-slate-200 bg-white px-1.5 py-0.5
                     text-[10px] font-semibold text-slate-400"
            >
              ⌘K
            </kbd>
          </button>

          <div class="flex items-center gap-4">
          <button
            type="button"
            (click)="openAiCreate()"
            class="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5
                   text-xs font-bold text-white shadow-md shadow-violet-500/25 transition-shadow
                   hover:shadow-lg hover:shadow-violet-500/40
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60
                   focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Open AI create dialog"
            data-testid="ai-create-trigger"
          >
            <i class="pi pi-sparkles text-[10px]" aria-hidden="true"></i>
            AI create
            <kbd class="ml-1 inline-flex items-center rounded bg-white/20 px-1 py-0.5 text-[9px] font-semibold tracking-wide">
              ⌘I
            </kbd>
          </button>
          @if (activeTimer(); as t) {
            <div
              class="inline-flex items-center gap-2 px-2 py-1 rounded-full
                     border border-emerald-200 bg-emerald-50 text-emerald-700"
              data-testid="active-timer-pill"
              role="status"
              [attr.aria-label]="'layout.timer.ariaActiveTimer' | translate"
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
                [attr.aria-label]="'layout.timer.goToTask' | translate: { title: activeTaskTitle() ?? t.taskId }"
              >
                {{ activeTaskTitle() ?? ('layout.timer.trackingTask' | translate) }}
              </button>
              <button
                type="button"
                (click)="stopTimer()"
                [disabled]="stopping()"
                class="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5
                       border border-rose-200 bg-rose-50 text-rose-600
                       hover:bg-rose-100 transition-colors disabled:opacity-60"
                [attr.aria-label]="'layout.timer.stopAria' | translate"
              >
                <span class="pi pi-stop-circle" aria-hidden="true"></span>
                {{ 'layout.timer.stop' | translate }}
              </button>
            </div>
          }
            <a routerLink="/notifications" [attr.aria-label]="'nav.notifications' | translate" class="text-slate-400 transition hover:text-indigo-600">
              <i class="pi pi-bell text-sm" aria-hidden="true"></i>
            </a>
            <button
              type="button"
              [attr.aria-label]="'nav.help' | translate"
              [attr.title]="('nav.help' | translate) + ' (⌘K)'"
              (click)="openCommandPalette()"
              class="text-slate-400 transition hover:text-indigo-600"
            >
              <i class="pi pi-question-circle text-sm" aria-hidden="true"></i>
            </button>

            <div class="relative">
              <button
                type="button"
                (click)="toggleUserMenu($event)"
                [attr.aria-expanded]="userMenuOpen()"
                aria-haspopup="menu"
                [attr.aria-label]="'layout.openAccountMenu' | translate"
                class="flex h-8 w-8 items-center justify-center rounded-full
                       bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white
                       shadow-md shadow-indigo-500/25
                       hover:shadow-lg hover:shadow-indigo-500/40
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                       focus-visible:ring-offset-2 focus-visible:ring-offset-white
                       transition-shadow"
              >
                {{ userInitials() }}
              </button>

              @if (userMenuOpen()) {
                <button
                  type="button"
                  class="fixed inset-0 z-30 cursor-default bg-transparent"
                  [attr.aria-label]="'layout.closeAccountMenu' | translate"
                  (click)="closeUserMenu()"
                ></button>
                <div
                  class="absolute right-0 top-10 z-40 w-60 rounded-xl border border-slate-200
                         bg-white shadow-xl shadow-slate-200/80 py-2"
                  role="menu"
                >
                  <div class="px-3 py-2 border-b border-slate-100">
                    <p class="truncate text-sm font-bold text-slate-950">
                      {{ userDisplayName() }}
                    </p>
                    <p class="truncate text-xs text-slate-500">
                      {{ userEmail() }}
                    </p>
                  </div>

                  <div class="px-3 py-2 border-b border-slate-100">
                    <p class="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      {{ 'common.language' | translate }}
                    </p>
                    <div class="flex gap-1.5" role="group" [attr.aria-label]="'common.language' | translate">
                      @for (loc of locales; track loc) {
                        <button
                          type="button"
                          (click)="setLocale(loc)"
                          [attr.aria-pressed]="currentLocale() === loc"
                          [class.bg-indigo-600]="currentLocale() === loc"
                          [class.text-white]="currentLocale() === loc"
                          [class.border-indigo-600]="currentLocale() === loc"
                          class="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200
                                 px-2 py-1 text-[10px] font-bold uppercase tracking-wider
                                 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
                        >
                          {{ loc }}
                        </button>
                      }
                    </div>
                  </div>

                  <a
                    routerLink="/settings"
                    role="menuitem"
                    (click)="closeUserMenu()"
                    class="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700
                           hover:bg-slate-50"
                  >
                    <i class="pi pi-cog text-[11px]" aria-hidden="true"></i> {{ 'layout.settings' | translate }}
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    (click)="logout()"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-rose-600
                           hover:bg-rose-50"
                  >
                    <i class="pi pi-sign-out text-[11px]" aria-hidden="true"></i> {{ 'layout.logout' | translate }}
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <main
          class="relative flex-1 min-h-0 overflow-auto bg-[#f8faff] p-4 text-slate-950 sm:p-5 lg:p-6"
          id="main-content"
        >
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <jt-toast-container></jt-toast-container>
    <jt-command-palette></jt-command-palette>
    <jt-ai-create-dialog></jt-ai-create-dialog>
  `,
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly shortcuts = inject(KeyboardShortcutService);
  private readonly palette = inject(CommandPaletteService);
  private readonly aiCreate = inject(AiCreateService);
  private readonly chatChannelStore = inject(ChatChannelStore);
  private readonly auth = inject(AuthService);
  private readonly timeStore = inject(TimeEntryStore);
  private readonly taskStore = inject(TaskStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);

  readonly chatUnread = this.chatChannelStore.totalUnread;
  readonly appVersion = APP_VERSION;
  readonly repoUrl = REPO_URL;
  readonly mobileNavOpen = signal(false);

  toggleMobileNav(): void {
    this.mobileNavOpen.update((v) => !v);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  private _unregisterCmdK?: () => void;
  private _unregisterHelp?: () => void;
  private _unregisterAiCreate?: () => void;
  private _unregisterRouter?: Subscription;
  private _tickHandle?: ReturnType<typeof setInterval>;

  private readonly http = inject(HttpClient);

  readonly stopping = computed(() => this.timeStore.stopping());
  readonly nowMs = signal<number>(Date.now());
  readonly userMenuOpen = signal(false);
  readonly workspaceMenuOpen = signal(false);
  readonly availableWorkspaces = signal<Array<{ id: string; name: string; slug: string; role: string }>>([]);

  readonly currentWorkspaceName = computed(
    () => this.auth.currentWorkspace()?.name ?? 'Workspace',
  );
  readonly currentWorkspaceId = computed(() => this.auth.currentWorkspace()?.id ?? null);

  readonly locales = SUPPORTED_LOCALES;
  readonly currentLocale = this.locale.current;

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly userDisplayName = computed(() => this.auth.currentUser()?.displayName ?? 'Guest');
  readonly userEmail = computed(() => this.auth.currentUser()?.email ?? '');
  readonly userInitials = computed(() => {
    const name = this.auth.currentUser()?.displayName?.trim() ?? '';
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + second).toUpperCase() || '?';
  });
  readonly activeTimer = computed(() => this.timeStore.activeTimer());
  readonly primaryNav = computed<NavItem[]>(() => [
    { labelKey: 'nav.dashboard', route: '/', icon: 'pi-th-large', exact: true },
    { labelKey: 'nav.projects', route: '/projects', icon: 'pi-folder' },
    { labelKey: 'nav.aiInsights', route: '/analytics', icon: 'pi-lightbulb' },
    { labelKey: 'nav.automations', route: '/my-time', icon: 'pi-sliders-h' },
    { labelKey: 'nav.tickets', route: '/tickets', icon: 'pi-exclamation-circle' },
    { labelKey: 'nav.docs', route: '/docs', icon: 'pi-file' },
    { labelKey: 'nav.chat', route: '/chat', icon: 'pi-comments', badge: 'chat' },
    ...(this.isAdmin()
      ? [
          { labelKey: 'nav.timeReports', route: '/time-reports', icon: 'pi-chart-bar' },
          { labelKey: 'nav.employees', route: '/employees', icon: 'pi-users' },
          { labelKey: 'nav.audit', route: '/audit', icon: 'pi-shield' },
        ]
      : []),
  ]);
  readonly footerNav: NavItem[] = [
    { labelKey: 'nav.settings', route: '/settings', icon: 'pi-cog' },
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
    this._unregisterAiCreate = this.shortcuts.register({
      key: 'cmd+i',
      handler: () => this.aiCreate.open(),
      context: 'Global',
    });
    void this.timeStore.loadActiveTimer();
    this._tickHandle = setInterval(() => this.nowMs.set(Date.now()), 1000);

    // Auto-close the mobile drawer on navigation so a tap on any link
    // doesn't leave the menu hovering over the destination page.
    this._unregisterRouter = this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationEnd) this.mobileNavOpen.set(false);
    });
  }

  ngOnDestroy(): void {
    this._unregisterCmdK?.();
    this._unregisterHelp?.();
    this._unregisterAiCreate?.();
    this._unregisterRouter?.unsubscribe();
    if (this._tickHandle) clearInterval(this._tickHandle);
  }

  openCommandPalette(): void {
    this.palette.open();
  }

  openAiCreate(): void {
    this.aiCreate.open();
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update(v => !v);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  async toggleWorkspaceMenu(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const willOpen = !this.workspaceMenuOpen();
    this.workspaceMenuOpen.set(willOpen);
    if (willOpen && this.availableWorkspaces().length === 0) {
      try {
        const list = await firstValueFrom(
          this.http.get<Array<{ id: string; name: string; slug: string; role: string }>>(
            '/api/v1/workspaces',
          ),
        );
        this.availableWorkspaces.set(list ?? []);
      } catch {
        this.toast.error('No pudimos cargar los workspaces');
      }
    }
  }

  closeWorkspaceMenu(): void {
    this.workspaceMenuOpen.set(false);
  }

  switchWorkspace(ws: { id: string; name: string; slug: string; role: string }): void {
    this.closeWorkspaceMenu();
    const current = this.auth.currentWorkspace();
    if (current?.id === ws.id) return;
    this.auth.switchWorkspace({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      role: ws.role as 'owner' | 'admin' | 'member',
    });
    // Force a hard reload so every store/route binding re-hydrates against
    // the new workspace cleanly. Simpler than threading "workspace-switched"
    // events through every store.
    window.location.assign('/');
  }

  setLocale(loc: SupportedLocale): void {
    this.locale.use(loc);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  goToTimerTask(): void {
    const t = this.activeTimer();
    if (!t) return;
    void this.router.navigate(['/tasks', t.taskId]);
  }

  async stopTimer(): Promise<void> {
    try {
      const result = await this.timeStore.stop();
      if (result) this.toast.success(this.translate.instant('layout.timer.stopped'));
    } catch {
      this.toast.error(this.translate.instant('layout.timer.stopFailed'));
    }
  }
}
