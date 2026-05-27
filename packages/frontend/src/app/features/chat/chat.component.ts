import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { ChatRealtimeService } from '../../core/chat-realtime/chat-realtime.service';
import {
  ChatApiService,
  ChatChannel,
  ChatMessage,
  WorkspaceContact,
} from '../../stores/chat-api.service';
import { WorkspaceMemberStore } from '../../stores/workspace-member.store';
import { AuthService } from '../../core/auth/auth.service';
import { CreateChannelComponent } from './create-channel.component';

function rankChannel(channel: ChatChannel): number {
  if (channel.kind === 'general') return 0;
  if (channel.kind === 'project') return 1;
  return 2;
}

@Component({
  selector: 'jt-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, FormsModule, CreateChannelComponent],
  template: `
    <div class="flex h-full min-h-0 overflow-hidden -m-4 bg-[#f8faff] sm:-m-5 lg:-m-6">
      <aside
        class="flex w-[19rem] shrink-0 flex-col border-r border-slate-200 bg-white"
        aria-label="Chat navigation"
      >
        <header class="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Messages</p>
            <h2 class="text-lg font-black tracking-tight text-slate-950">Chat</h2>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              (click)="openDmPicker()"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-800"
              aria-label="New direct message"
            >
              <i class="pi pi-user-plus text-sm" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              (click)="openCreate()"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-700 transition-colors hover:bg-violet-100 hover:text-violet-900"
              aria-label="New space"
            >
              <i class="pi pi-plus text-sm" aria-hidden="true"></i>
            </button>
          </div>
        </header>

        <div class="px-3 py-3">
          <label class="sr-only" for="chat-search">Search messages</label>
          <input
            id="chat-search"
            type="search"
            placeholder="Search..."
            [(ngModel)]="searchQuery"
            (input)="onSearchInput()"
            class="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700
                   placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
          />
        </div>

        @if (searchResults().length > 0) {
          <div class="px-3 pb-3">
            <p class="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Search results
            </p>
            <ul class="space-y-1">
              @for (m of searchResults(); track m.id) {
                <li>
                  <button
                    type="button"
                    (click)="openSearchResult(m)"
                    class="block w-full truncate rounded-md px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-100"
                  >
                    {{ m.body }}
                  </button>
                </li>
              }
            </ul>
          </div>
        }

        <div class="flex-1 overflow-y-auto px-2">
          <section class="pb-4">
            <p class="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Channels
            </p>
            <ul class="space-y-0.5">
              @for (ch of channels(); track ch.id) {
                <li>
                  <button
                    type="button"
                    (click)="selectChannel(ch.id)"
                    [class.bg-violet-50]="selectedId() === ch.id"
                    [class.text-violet-800]="selectedId() === ch.id"
                    class="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm
                           font-medium text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-800"
                    [attr.aria-current]="selectedId() === ch.id ? 'page' : null"
                  >
                    <span class="flex min-w-0 items-center gap-1.5 truncate">
                      @if (ch.type === 'private') {
                        <i class="pi pi-lock text-[10px] text-slate-500" aria-hidden="true"></i>
                      } @else {
                        <span class="text-slate-500">#</span>
                      }
                      <span class="truncate">{{ ch.name }}</span>
                    </span>
                    @if (unreadFor(ch.id) > 0) {
                      <span
                        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white"
                      >
                        {{ unreadFor(ch.id) }}
                      </span>
                    }
                  </button>
                </li>
              }
              @if (channels().length === 0) {
                <li class="mx-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">No spaces yet.</li>
              }
            </ul>
          </section>

          <section class="pb-4">
            <div class="mb-2 flex items-center justify-between px-2">
              <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Direct messages
              </p>
              <button type="button" (click)="openDmPicker()" class="text-[10px] font-bold text-violet-700 hover:text-violet-900">
                New
              </button>
            </div>
            <ul class="space-y-0.5">
              @for (dm of dms(); track dm.id) {
                <li>
                  <button
                    type="button"
                    (click)="selectChannel(dm.id)"
                    [class.bg-violet-50]="selectedId() === dm.id"
                    [class.text-violet-800]="selectedId() === dm.id"
                    class="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm
                           font-medium text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-800"
                  >
                    <span class="flex min-w-0 items-center gap-1.5 truncate">
                      <i class="pi pi-user text-[10px] text-slate-500" aria-hidden="true"></i>
                      <span class="truncate">{{ dmLabel(dm) }}</span>
                    </span>
                    @if (unreadFor(dm.id) > 0) {
                      <span
                        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white"
                      >
                        {{ unreadFor(dm.id) }}
                      </span>
                    }
                  </button>
                </li>
              }
              @if (dms().length === 0) {
                <li class="mx-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">No direct messages yet.</li>
              }
            </ul>
          </section>
        </div>
      </aside>

      <div class="flex flex-1 min-w-0 flex-col bg-[#f8faff]">
        @if (!selectedId()) {
          <section class="flex flex-1 items-center justify-center p-8" aria-label="Chat welcome">
            <div class="max-w-md rounded-3xl border border-slate-200 bg-white px-10 py-9 text-center shadow-sm shadow-slate-200/70">
              <span class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <i class="pi pi-comments text-2xl" aria-hidden="true"></i>
              </span>
              <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">Spaces</p>
              <h2 class="mt-2 text-2xl font-black tracking-tight text-slate-950">Start a conversation</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-500">
                Create a space for a project, or open a direct message to keep decisions near the work.
              </p>
              <button
                type="button"
                (click)="openCreate()"
                class="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700"
              >
                <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                New space
              </button>
            </div>
          </section>
        }
        <router-outlet></router-outlet>
      </div>
    </div>

    <jt-create-channel
      [open]="createOpen()"
      (created)="onChannelCreated($event)"
      (closed)="createOpen.set(false)"
    />

    @if (dmOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-dm-title"
        (click)="closeDmPicker()"
      >
        <section
          class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
          (click)="$event.stopPropagation()"
        >
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">Direct message</p>
          <h2 id="new-dm-title" class="mb-4 mt-2 text-xl font-black text-slate-950">Start a chat</h2>
          <label class="sr-only" for="dm-search">Find a teammate</label>
          <input
            id="dm-search"
            type="search"
            [(ngModel)]="contactQuery"
            placeholder="Find a teammate"
            class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-violet-400 focus:bg-white focus:outline-none"
          />
          @if (contactsLoading()) {
            <p class="py-6 text-center text-sm text-slate-500">Loading teammates...</p>
          } @else if (dmError()) {
            <p class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ dmError() }}</p>
          } @else {
            <ul class="max-h-72 space-y-1 overflow-y-auto" aria-label="Workspace teammates">
              @for (contact of filteredContacts(); track contact.userId) {
                <li>
                  <button
                    type="button"
                    (click)="startDirectMessage(contact)"
                    [disabled]="dmCreatingFor() === contact.userId"
                    class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-violet-50 disabled:opacity-60"
                  >
                    <span class="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                      {{ contactInitials(contact) }}
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-semibold text-slate-900">{{ contact.displayName }}</span>
                      <span class="block truncate text-xs text-slate-500">{{ contact.email }}</span>
                    </span>
                    @if (dmCreatingFor() === contact.userId) {
                      <i class="pi pi-spin pi-spinner text-violet-600" aria-hidden="true"></i>
                    }
                  </button>
                </li>
              } @empty {
                <li class="py-7 text-center text-sm text-slate-500">No teammates found.</li>
              }
            </ul>
          }
          <div class="mt-4 flex justify-end">
            <button type="button" (click)="closeDmPicker()" class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly channelStore = inject(ChatChannelStore);
  private readonly memberStore = inject(WorkspaceMemberStore);
  private readonly chatApi = inject(ChatApiService);
  private readonly realtime = inject(ChatRealtimeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly searchQuery = signal('');
  readonly searchResults = signal<ChatMessage[]>([]);
  readonly createOpen = signal(false);
  readonly dmOpen = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly contactQuery = signal('');
  readonly dmCreatingFor = signal<string | null>(null);
  readonly dmError = signal<string | null>(null);

  readonly contacts = this.memberStore.members;
  readonly contactsLoading = this.memberStore.loading;

  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly channels = computed(() =>
    [...this.channelStore.channels()].sort((a, b) => {
      const rankDiff = rankChannel(a) - rankChannel(b);
      if (rankDiff !== 0) return rankDiff;
      const aTs = a.lastMessageAt ?? a.createdAt;
      const bTs = b.lastMessageAt ?? b.createdAt;
      return bTs.localeCompare(aTs);
    }),
  );
  readonly dms = computed(() => this.channelStore.dms());
  readonly filteredContacts = computed(() => {
    const me = this.auth.currentUser()?.id;
    const query = this.contactQuery().trim().toLowerCase();
    return this.contacts().filter((contact) => {
      if (contact.userId === me) return false;
      return !query ||
        contact.displayName.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query);
    });
  });

  ngOnInit(): void {
    this.realtime.connect();
    void this.channelStore.refresh();
    // sync selectedId with URL on first load
    const segments = this.router.url.split('/');
    const idx = segments.indexOf('chat');
    if (idx !== -1 && segments[idx + 1]) this.selectedId.set(segments[idx + 1]);
  }

  selectChannel(id: string): void {
    this.selectedId.set(id);
    void this.router.navigate(['/chat', id]);
  }

  openCreate(): void {
    this.createOpen.set(true);
  }

  openDmPicker(): void {
    this.dmOpen.set(true);
    this.dmError.set(null);
    void this.memberStore.refresh();
  }

  closeDmPicker(): void {
    this.dmOpen.set(false);
    this.contactQuery.set('');
    this.dmError.set(null);
  }

  onChannelCreated(channel: ChatChannel): void {
    this.channelStore.upsert(channel);
    this.createOpen.set(false);
    this.selectChannel(channel.id);
  }

  onSearchInput(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    const q = this.searchQuery().trim();
    if (q.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this._searchTimer = setTimeout(async () => {
      try {
        const results = await this.chatApi.search(q);
        this.searchResults.set(results);
      } catch {
        this.searchResults.set([]);
      }
    }, 250);
  }

  openSearchResult(m: ChatMessage): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.selectChannel(m.channelId);
  }

  unreadFor(channelId: string): number {
    return this.channelStore.unreadFor(channelId);
  }

  dmLabel(channel: ChatChannel): string {
    const me = this.auth.currentUser()?.id ?? '';
    return this.memberStore.dmTitleFor(channel.name, me);
  }

  contactInitials(contact: WorkspaceContact): string {
    return contact.displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  async startDirectMessage(contact: WorkspaceContact): Promise<void> {
    this.dmCreatingFor.set(contact.userId);
    this.dmError.set(null);
    try {
      const dm = await this.chatApi.openOrCreateDM(contact.userId);
      this.channelStore.upsert(dm);
      this.closeDmPicker();
      this.selectChannel(dm.id);
    } catch {
      this.dmError.set('Could not start this conversation.');
    } finally {
      this.dmCreatingFor.set(null);
    }
  }

  ngOnDestroy(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.realtime.disconnect();
  }
}
