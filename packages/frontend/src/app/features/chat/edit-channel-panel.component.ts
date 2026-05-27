import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChatApiService,
  ChatChannel,
  ChatChannelMember,
  WorkspaceContact,
} from '../../stores/chat-api.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { EmojiPickerComponent } from './emoji-picker.component';

/**
 * Right-side drawer that lets channel admins/creators rename a channel,
 * change its emoji icon, update its description, and manage members.
 *
 * Layout: fixed inset-y-0 right-0, ~26rem wide. Renders a backdrop behind
 * so the drawer can be dismissed by clicking outside.
 */
@Component({
  selector: 'jt-edit-channel-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, EmojiPickerComponent],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]"
        (click)="onBackdrop()"
        aria-hidden="true"
      ></div>
      <aside
        class="fixed inset-y-0 right-0 z-50 flex w-[26rem] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/15"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-channel-title"
      >
        <header class="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div class="min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">Channel</p>
            <h2 id="edit-channel-title" class="mt-1 text-lg font-black tracking-tight text-slate-950">
              Edit channel
            </h2>
          </div>
          <button
            type="button"
            (click)="onClose()"
            class="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close edit panel"
          >
            <i class="pi pi-times text-xs" aria-hidden="true"></i>
          </button>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-7">
          <!-- Settings ───────────────────────────────────────────── -->
          <section aria-labelledby="settings-heading" class="space-y-4">
            <h3 id="settings-heading" class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Settings
            </h3>

            <form [formGroup]="form" class="space-y-4">
              <div class="flex items-start gap-3">
                <div class="relative">
                  <button
                    type="button"
                    (click)="toggleIconPicker($event)"
                    class="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-2xl
                           transition-colors hover:bg-slate-100 hover:border-slate-300
                           focus:outline-none focus:ring-2 focus:ring-violet-300"
                    [attr.aria-label]="iconValue() ? 'Change channel icon' : 'Add channel icon'"
                    [attr.aria-expanded]="iconPickerOpen()"
                  >
                    @if (iconValue()) {
                      <span aria-hidden="true">{{ iconValue() }}</span>
                    } @else {
                      <i class="pi pi-image text-base text-slate-500" aria-hidden="true"></i>
                    }
                  </button>
                  @if (iconPickerOpen()) {
                    <div class="absolute left-0 top-14 z-30">
                      <jt-emoji-picker
                        (picked)="onPickIcon($event)"
                        (dismissed)="iconPickerOpen.set(false)"
                      />
                    </div>
                  }
                  @if (iconValue()) {
                    <button
                      type="button"
                      (click)="clearIcon()"
                      class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-white shadow hover:bg-slate-700"
                      aria-label="Clear icon"
                    >
                      <i class="pi pi-times text-[8px]" aria-hidden="true"></i>
                    </button>
                  }
                </div>

                <label class="flex-1 block">
                  <span class="block text-xs font-semibold text-slate-600 mb-1">Name</span>
                  <input
                    type="text"
                    formControlName="name"
                    maxlength="80"
                    placeholder="e.g. design-feedback"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700
                           placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
                  />
                </label>
              </div>

              <label class="block">
                <span class="block text-xs font-semibold text-slate-600 mb-1">Description</span>
                <textarea
                  formControlName="description"
                  rows="3"
                  maxlength="500"
                  placeholder="What is this channel for?"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700
                         placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
                ></textarea>
              </label>
            </form>
          </section>

          <!-- Members ────────────────────────────────────────────── -->
          <section aria-labelledby="members-heading" class="space-y-3">
            <div class="flex items-baseline justify-between">
              <h3 id="members-heading" class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Members ({{ members().length }})
              </h3>
            </div>

            <label class="block">
              <span class="sr-only">Search members</span>
              <input
                type="search"
                [value]="memberQuery()"
                (input)="onMemberQuery($event)"
                placeholder="Search current members"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700
                       placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
              />
            </label>

            <ul class="space-y-1" aria-label="Channel members">
              @for (m of filteredMembers(); track m.userId) {
                <li class="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                    [style.background]="avatarBg(m.userId)"
                    [style.color]="avatarFg(m.userId)"
                  >
                    {{ initialsFor(m.userId) }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-slate-900">
                      {{ displayName(m.userId) }}
                    </span>
                    <span class="block truncate text-[10px] text-slate-500">
                      {{ emailFor(m.userId) }}
                    </span>
                  </span>
                  <button
                    type="button"
                    (click)="onMarkRemove(m.userId)"
                    class="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600
                           focus:outline-none focus:ring-2 focus:ring-rose-300"
                    [attr.aria-label]="'Remove ' + displayName(m.userId)"
                  >
                    <i class="pi pi-times text-[10px]" aria-hidden="true"></i>
                  </button>
                </li>
              } @empty {
                <li class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
                  No members match.
                </li>
              }
            </ul>

            <div class="pt-2">
              <p class="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Add member</p>
              <label class="block">
                <span class="sr-only">Find a teammate to add</span>
                <input
                  type="search"
                  [value]="addQuery()"
                  (input)="onAddQuery($event)"
                  placeholder="Find a teammate"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700
                         placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
                />
              </label>
              @if (addQuery().trim().length > 0) {
                <ul class="mt-2 max-h-56 space-y-1 overflow-y-auto" aria-label="Add candidates">
                  @for (c of candidates(); track c.userId) {
                    <li class="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-violet-50">
                      <span
                        class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                        [style.background]="avatarBg(c.userId)"
                        [style.color]="avatarFg(c.userId)"
                      >
                        {{ initialsFor(c.userId) }}
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-semibold text-slate-900">
                          {{ c.displayName }}
                        </span>
                        <span class="block truncate text-[10px] text-slate-500">{{ c.email }}</span>
                      </span>
                      <button
                        type="button"
                        (click)="onMarkAdd(c)"
                        class="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-200"
                      >
                        Add
                      </button>
                    </li>
                  } @empty {
                    <li class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
                      No teammates match.
                    </li>
                  }
                </ul>
              }
            </div>
          </section>
        </div>

        @if (error()) {
          <div role="alert" class="px-5 pb-2 text-xs text-rose-600">{{ error() }}</div>
        }

        <footer class="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <span class="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            @if (dirty()) { Unsaved changes } @else { Up to date }
          </span>
          <div class="flex gap-2">
            <button
              type="button"
              (click)="onClose()"
              class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="save()"
              [disabled]="!dirty() || submitting()"
              class="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-bold text-white
                     disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ submitting() ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </footer>
      </aside>
    }
  `,
})
export class EditChannelPanelComponent {
  private readonly api = inject(ChatApiService);
  private readonly memberStore = inject(WorkspaceMemberStore);
  private readonly channelStore = inject(ChatChannelStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly channelId = input<string | null>(null);
  readonly open = input<boolean>(false);

  readonly closed = output<void>();
  readonly updated = output<ChatChannel>();

  readonly form = this.fb.nonNullable.group({
    name: [''],
    description: [''],
  });

  readonly iconValue = signal<string | null>(null);
  readonly iconPickerOpen = signal(false);
  readonly memberQuery = signal('');
  readonly addQuery = signal('');

  /** Current member list, keyed by userId. */
  readonly members = signal<ChatChannelMember[]>([]);
  /** UserIds queued to be added when the user clicks "Save changes". */
  readonly pendingAdds = signal<string[]>([]);
  /** UserIds queued to be removed when the user clicks "Save changes". */
  readonly pendingRemoves = signal<string[]>([]);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  private _channel: ChatChannel | null = null;
  private _initialName = '';
  private _initialDescription = '';
  private _initialIcon: string | null = null;

  // Whether the form is "dirty" relative to the loaded channel.
  readonly dirty = computed(() => {
    const name = this.form.controls.name.value;
    const description = this.form.controls.description.value;
    if (name !== this._initialName) return true;
    if (description !== this._initialDescription) return true;
    if (this.iconValue() !== this._initialIcon) return true;
    if (this.pendingAdds().length > 0) return true;
    if (this.pendingRemoves().length > 0) return true;
    return false;
  });

  readonly filteredMembers = computed(() => {
    const q = this.memberQuery().trim().toLowerCase();
    const removeSet = new Set(this.pendingRemoves());
    const addSet = this.pendingAdds();
    const base = this.members()
      .filter(m => !removeSet.has(m.userId))
      .map(m => m.userId);
    const all = [...base, ...addSet];
    const unique = Array.from(new Set(all));
    return unique
      .map(uid => ({ userId: uid }))
      .filter(({ userId }) => {
        if (!q) return true;
        return this.displayName(userId).toLowerCase().includes(q) ||
          this.emailFor(userId).toLowerCase().includes(q);
      });
  });

  readonly candidates = computed<WorkspaceContact[]>(() => {
    const q = this.addQuery().trim().toLowerCase();
    if (!q) return [];
    const memberIds = new Set([
      ...this.members().map(m => m.userId),
      ...this.pendingAdds(),
    ]);
    const removeSet = new Set(this.pendingRemoves());
    return this.memberStore.members().filter(c => {
      // Hide current members (unless they are queued for removal).
      if (memberIds.has(c.userId) && !removeSet.has(c.userId)) return false;
      if (c.userId === this.auth.currentUser()?.id) return false;
      return c.displayName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    }).slice(0, 20);
  });

  constructor() {
    // Hydrate form whenever the panel opens for a new channel.
    effect(() => {
      const id = this.channelId();
      const isOpen = this.open();
      if (!isOpen || !id) {
        // Reset internal state on close so reopening starts fresh.
        if (!isOpen) this._resetState();
        return;
      }
      this._loadChannel(id);
    });

    // Keep the form alive — nothing extra needed, but ensure destroy cleans up
    // any pending subscriptions consumers might wire later.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // No-op: dirty() recomputes from form controls.
      });
  }

  // ── User actions ────────────────────────────────────────────────────────

  onBackdrop(): void {
    this.onClose();
  }

  onClose(): void {
    this.closed.emit();
  }

  toggleIconPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.iconPickerOpen.update(v => !v);
  }

  onPickIcon(emoji: string): void {
    this.iconValue.set(emoji);
    this.iconPickerOpen.set(false);
  }

  clearIcon(): void {
    this.iconValue.set(null);
  }

  onMemberQuery(event: Event): void {
    this.memberQuery.set((event.target as HTMLInputElement).value);
  }

  onAddQuery(event: Event): void {
    this.addQuery.set((event.target as HTMLInputElement).value);
  }

  onMarkAdd(contact: WorkspaceContact): void {
    // If they were marked for removal previously, just undo that.
    if (this.pendingRemoves().includes(contact.userId)) {
      this.pendingRemoves.update(list => list.filter(id => id !== contact.userId));
      return;
    }
    if (!this.pendingAdds().includes(contact.userId)) {
      this.pendingAdds.update(list => [...list, contact.userId]);
    }
    this.addQuery.set('');
  }

  onMarkRemove(userId: string): void {
    // If they were a pending-add, just drop them from pendingAdds.
    if (this.pendingAdds().includes(userId)) {
      this.pendingAdds.update(list => list.filter(id => id !== userId));
      return;
    }
    if (!this.pendingRemoves().includes(userId)) {
      this.pendingRemoves.update(list => [...list, userId]);
    }
  }

  async save(): Promise<void> {
    const channel = this._channel;
    if (!channel) return;
    this.error.set(null);
    this.submitting.set(true);

    const trimmedName = this.form.controls.name.value.trim();
    const trimmedDesc = this.form.controls.description.value.trim();
    const nextIcon = this.iconValue();

    // Build minimal PATCH body — only include keys that actually changed.
    const body: { name?: string; description?: string; icon?: string | null } = {};
    if (trimmedName && trimmedName !== this._initialName) body.name = trimmedName;
    if (trimmedDesc !== this._initialDescription) body.description = trimmedDesc;
    if (nextIcon !== this._initialIcon) body.icon = nextIcon ?? '';

    try {
      let updated: ChatChannel = channel;
      if (Object.keys(body).length > 0) {
        updated = await this.api.updateChannel(channel.id, body);
        this.channelStore.upsert(updated);
      }

      // Then process membership diffs sequentially so the failure-mode is
      // easier to reason about than a giant Promise.all that partially fails.
      for (const userId of this.pendingAdds()) {
        await this.api.addMember(channel.id, userId);
      }
      for (const userId of this.pendingRemoves()) {
        await this.api.removeMember(channel.id, userId);
      }

      this.toast.success('Channel updated');
      this.updated.emit(updated);
      this.closed.emit();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update the channel.';
      this.error.set(message);
      this.toast.error(message);
    } finally {
      this.submitting.set(false);
    }
  }

  // ── Display helpers ─────────────────────────────────────────────────────

  displayName(userId: string): string {
    return this.memberStore.displayNameFor(userId);
  }

  emailFor(userId: string): string {
    return this.memberStore.memberFor(userId)?.email ?? '';
  }

  initialsFor(userId: string): string {
    return this.memberStore.initialsFor(userId);
  }

  avatarBg(userId: string): string {
    return this.memberStore.avatarColorFor(userId);
  }

  avatarFg(userId: string): string {
    return this.memberStore.avatarForegroundFor(userId);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async _loadChannel(id: string): Promise<void> {
    this.error.set(null);
    // Hydrate from store if we already have the channel; refresh in background.
    const stored = this.channelStore.byId()[id] ?? null;
    if (stored) this._applyChannel(stored);

    void this.memberStore.refresh();

    try {
      const [channel, members] = await Promise.all([
        this.api.getChannel(id),
        this.api.listMembers(id).catch(() => [] as ChatChannelMember[]),
      ]);
      this._applyChannel(channel);
      this.members.set(members);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load channel.');
    }
  }

  private _applyChannel(channel: ChatChannel): void {
    this._channel = channel;
    this._initialName = channel.name;
    this._initialDescription = channel.description ?? '';
    this._initialIcon = channel.icon ?? null;
    this.form.setValue(
      {
        name: channel.name,
        description: channel.description ?? '',
      },
      { emitEvent: false },
    );
    this.iconValue.set(channel.icon ?? null);
  }

  private _resetState(): void {
    this._channel = null;
    this._initialName = '';
    this._initialDescription = '';
    this._initialIcon = null;
    this.members.set([]);
    this.pendingAdds.set([]);
    this.pendingRemoves.set([]);
    this.iconValue.set(null);
    this.iconPickerOpen.set(false);
    this.memberQuery.set('');
    this.addQuery.set('');
    this.error.set(null);
    this.submitting.set(false);
    this.form.reset({ name: '', description: '' }, { emitEvent: false });
  }
}
