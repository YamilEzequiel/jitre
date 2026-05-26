import { Injectable, OnDestroy } from '@angular/core';

export interface ShortcutDefinition {
  /** e.g. 'cmd+k', '?', 'g p', 'Escape' */
  key: string;
  handler: (event: KeyboardEvent) => void;
  context?: string;
}

interface RegisteredShortcut extends ShortcutDefinition {
  id: symbol;
}

const SEQUENCE_TIMEOUT_MS = 1500;

function isTypingInInput(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/**
 * Normalize a shortcut key string to a canonical form.
 * 'cmd+k' → { modifier: 'cmd', key: 'k' }
 */
function parseShortcut(key: string): { parts: string[]; isSequence: boolean } {
  const trimmed = key.trim();
  const isSequence = trimmed.includes(' ');
  return {
    parts: isSequence ? trimmed.split(/\s+/) : [trimmed],
    isSequence,
  };
}

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutService implements OnDestroy {
  private readonly _shortcuts: RegisteredShortcut[] = [];
  private _sequenceBuffer: string[] = [];
  private _sequenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly _listener: (e: KeyboardEvent) => void;

  constructor() {
    this._listener = (event: KeyboardEvent) => this._handleKeydown(event);
    document.addEventListener('keydown', this._listener);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this._listener);
  }

  register(definition: ShortcutDefinition): () => void {
    const id = Symbol();
    const entry: RegisteredShortcut = { ...definition, id };
    this._shortcuts.push(entry);
    return () => {
      const idx = this._shortcuts.findIndex(s => s.id === id);
      if (idx !== -1) this._shortcuts.splice(idx, 1);
    };
  }

  getAll(): ShortcutDefinition[] {
    return this._shortcuts.map(({ id: _id, ...rest }) => rest);
  }

  private _handleKeydown(event: KeyboardEvent): void {
    const keyStr = this._eventToKeyString(event);
    const isEscape = event.key === 'Escape';

    if (isTypingInInput(event) && !isEscape) return;

    // Single-key (non-sequence) shortcuts
    for (const shortcut of this._shortcuts) {
      const { parts, isSequence } = parseShortcut(shortcut.key);
      if (!isSequence && parts[0] === keyStr) {
        shortcut.handler(event);
        return;
      }
    }

    // Sequence shortcuts
    const hasSequenceShortcuts = this._shortcuts.some(s => parseShortcut(s.key).isSequence);
    if (!hasSequenceShortcuts) return;

    this._sequenceBuffer.push(keyStr);
    if (this._sequenceTimeout) clearTimeout(this._sequenceTimeout);
    this._sequenceTimeout = setTimeout(() => {
      this._sequenceBuffer = [];
    }, SEQUENCE_TIMEOUT_MS);

    const bufferStr = this._sequenceBuffer.join(' ');
    for (const shortcut of this._shortcuts) {
      const { isSequence, parts } = parseShortcut(shortcut.key);
      if (isSequence && parts.join(' ') === bufferStr) {
        this._sequenceBuffer = [];
        if (this._sequenceTimeout) clearTimeout(this._sequenceTimeout);
        shortcut.handler(event);
        return;
      }
    }
  }

  private _eventToKeyString(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.metaKey || event.ctrlKey) parts.push('cmd');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey && event.key.length > 1) parts.push('shift');
    // For regular characters, lowercase unless it's a special key
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    parts.push(key);
    return parts.join('+');
  }
}
