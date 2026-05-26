import { Injectable, signal } from '@angular/core';
import { CommandResult, RecentItemsHelper } from './recent-items.helper';

export interface CommandProvider {
  search(query: string, signal?: AbortSignal): Promise<CommandResult[]>;
}

const MAX_RESULTS = 50;

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly _isOpen = signal<boolean>(false);
  readonly isOpen = this._isOpen.asReadonly();

  private readonly _providers: CommandProvider[] = [];
  readonly recents = new RecentItemsHelper();

  private _abortController: AbortController | null = null;

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  registerProvider(provider: CommandProvider): void {
    this._providers.push(provider);
  }

  async search(query: string): Promise<CommandResult[]> {
    // Abort previous in-flight search
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    if (!query.trim()) {
      return this.recents.get();
    }

    const results = await Promise.allSettled(
      this._providers.map(p => p.search(query, signal)),
    );

    const combined: CommandResult[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        combined.push(...result.value);
      } else {
        console.warn('[CommandPaletteService] provider failed:', result.reason);
      }
    }

    return combined.slice(0, MAX_RESULTS);
  }
}
