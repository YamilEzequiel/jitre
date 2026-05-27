import { Injectable, signal } from '@angular/core';

/**
 * Global open/close state for the AI create dialog.
 *
 * Kept separate from `AiGeneratorApiService` so the trigger (topbar button,
 * keyboard shortcut, future contextual triggers) can flip the dialog open
 * without needing to know about the HTTP layer.
 */
@Injectable({ providedIn: 'root' })
export class AiCreateService {
  private readonly _isOpen = signal(false);
  readonly isOpen = this._isOpen.asReadonly();

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  toggle(): void {
    this._isOpen.update((v) => !v);
  }
}
