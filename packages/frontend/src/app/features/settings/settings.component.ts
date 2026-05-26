import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { UserSettingsPanelComponent } from './panels/user-settings-panel.component';
import { NotificationSettingsPanelComponent } from './panels/notification-settings-panel.component';
import { WorkspaceSettingsPanelComponent } from './panels/workspace-settings-panel.component';
import { AiSettingsPanelComponent } from './panels/ai-settings-panel.component';

type SettingsTab = 'profile' | 'notifications' | 'workspace' | 'ai';

interface TabDef {
  value: SettingsTab;
  label: string;
  adminOnly: boolean;
}

@Component({
  selector: 'jt-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UserSettingsPanelComponent, NotificationSettingsPanelComponent, WorkspaceSettingsPanelComponent, AiSettingsPanelComponent],
  template: `
    <div class="max-w-6xl space-y-6">
      <header class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 space-y-3">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full
                 border border-violet-200 bg-violet-50"
        >
          <span
            class="text-[10px] font-bold uppercase tracking-[0.18em]
                   text-violet-700"
          >
            Preferences
          </span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-black tracking-tight">
          <span class="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
      </header>

      <div class="flex flex-col md:flex-row gap-6">
        <!-- Sidebar navigation -->
        <nav class="md:w-56 shrink-0">
          <ul role="list" class="space-y-1">
            @for (tab of visibleTabs(); track tab.value) {
              <li>
                <button
                  role="tab"
                  [attr.aria-selected]="activeTab() === tab.value"
                  [class]="
                    'group w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm font-medium border transition-colors ' +
                    (activeTab() === tab.value
                      ? 'bg-violet-50 border-violet-200 text-violet-700 shadow-sm'
                      : 'text-slate-600 border-transparent hover:bg-violet-100 hover:border-violet-200 hover:text-violet-900')
                  "
                  (click)="activeTab.set(tab.value)"
                >
                  <span
                    [class]="
                      'h-1.5 w-1.5 rounded-full transition-colors ' +
                      (activeTab() === tab.value
                        ? 'bg-gradient-to-r from-indigo-400 to-violet-400'
                        : 'bg-slate-300 group-hover:bg-violet-300')
                    "
                    aria-hidden="true"
                  ></span>
                  {{ tab.label }}
                </button>
              </li>
            }
          </ul>
        </nav>

        <!-- Content -->
        <div class="flex-1 min-w-0" role="tabpanel">
          @switch (activeTab()) {
            @case ('profile') {
              <jt-user-settings-panel />
            }
            @case ('notifications') {
              <jt-notification-settings-panel />
            }
            @case ('workspace') {
              <jt-workspace-settings-panel />
            }
            @case ('ai') {
              <jt-ai-settings-panel />
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);

  readonly activeTab = signal<SettingsTab>('profile');

  readonly isAdmin = computed(() => {
    const role = this.auth.currentWorkspace()?.role;
    return role === 'owner' || role === 'admin';
  });

  private readonly allTabs: TabDef[] = [
    { value: 'profile', label: 'Profile', adminOnly: false },
    { value: 'notifications', label: 'Notifications', adminOnly: false },
    { value: 'workspace', label: 'Workspace', adminOnly: true },
    { value: 'ai', label: 'AI & Quota', adminOnly: true },
  ];

  readonly visibleTabs = computed<TabDef[]>(() =>
    this.allTabs.filter(t => !t.adminOnly || this.isAdmin()),
  );
}
