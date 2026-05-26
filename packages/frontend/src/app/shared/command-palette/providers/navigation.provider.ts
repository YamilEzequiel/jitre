import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CommandProvider } from '../command-palette.service';
import type { CommandResult } from '../recent-items.helper';

const STATIC_ROUTES: Array<{ path: string; label: string }> = [
  { path: '/', label: 'Dashboard' },
  { path: '/projects', label: 'Projects' },
  { path: '/settings', label: 'Settings' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/settings/profile', label: 'Profile Settings' },
  { path: '/settings/workspace', label: 'Workspace Settings' },
  { path: '/settings/notifications', label: 'Notification Settings' },
];

@Injectable({ providedIn: 'root' })
export class NavigationProvider implements CommandProvider {
  private readonly router = inject(Router);

  async search(query: string): Promise<CommandResult[]> {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? STATIC_ROUTES.filter(r => r.label.toLowerCase().includes(q))
      : STATIC_ROUTES;

    return filtered.map(r => ({
      id: `nav:${r.path}`,
      label: r.label,
      type: 'navigation' as const,
      action: () => this.router.navigateByUrl(r.path),
    }));
  }
}
