import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

const SETTINGS_TABS: Array<{ id: string; label: string; path: string }> = [
  { id: 'settings:profile', label: 'Profile Settings', path: '/settings/profile' },
  { id: 'settings:workspace', label: 'Workspace Settings', path: '/settings/workspace' },
  { id: 'settings:ai', label: 'AI Settings', path: '/settings/ai' },
  { id: 'settings:notifications', label: 'Notification Settings', path: '/settings/notifications' },
];

@Injectable({ providedIn: 'root' })
export class SettingsProvider implements CommandProvider {
  private readonly router = inject(Router);

  async search(query: string): Promise<CommandResult[]> {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? SETTINGS_TABS.filter(s => s.label.toLowerCase().includes(q))
      : SETTINGS_TABS;

    return filtered.map(s => ({
      id: s.id,
      label: s.label,
      type: 'settings' as const,
      action: () => this.router.navigateByUrl(s.path),
    }));
  }
}
