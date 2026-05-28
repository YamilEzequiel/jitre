export interface CommandResult {
  id: string;
  label: string;
  type: 'task' | 'project' | 'document' | 'comment' | 'navigation' | 'ai' | 'settings';
  icon?: string;
  description?: string;
  action: () => void;
}

interface StoredItem {
  id: string;
  label: string;
  type: CommandResult['type'];
  description?: string;
}

const MAX_RECENT = 10;

export class RecentItemsHelper {
  private readonly storageKey: string;

  constructor(storageKey = 'jt_command_recents') {
    this.storageKey = storageKey;
  }

  get(): CommandResult[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const stored: StoredItem[] = JSON.parse(raw);
      return stored.map(s => ({ ...s, action: () => {} }));
    } catch {
      return [];
    }
  }

  add(item: CommandResult): void {
    const current = this.get();
    const filtered = current.filter(i => i.id !== item.id);
    const updated = [item, ...filtered].slice(0, MAX_RECENT);
    const toStore: StoredItem[] = updated.map(({ id, label, type, description }) => ({
      id,
      label,
      type,
      description,
    }));
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(toStore));
    } catch {
      // localStorage unavailable (test env or quota)
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }
}
