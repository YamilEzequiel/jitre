import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChatChannelStore } from '../../stores/chat-channel.store';
import { ChatMessageStore } from '../../stores/chat-message.store';
import { ChatPresenceStore } from '../../stores/chat-presence.store';
import { ChatApiService, ChatMessage } from '../../stores/chat-api.service';
import { ChatRealtimeService } from '../../core/chat-realtime/chat-realtime.service';
import { AuthService } from '../../core/auth/auth.service';
import { MarkdownPipe } from '../../shared/markdown/markdown.pipe';
import { MessageInputComponent } from './message-input.component';
import { hashHue, initialsFor, formatTime, shouldGroupWith, shortId } from './chat-utils';

interface RenderedMessage {
  message: ChatMessage;
  showHeader: boolean;
  indent: boolean;
}

@Component({
  selector: 'jt-chat-channel-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MessageInputComponent],
  providers: [MarkdownPipe],
  template: `
    <section class="relative flex h-full min-h-0 flex-1 bg-white">
      <div class="flex min-h-0 flex-1 flex-col">
      <header
        class="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white"
      >
        @if (channel(); as ch) {
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-lg font-black tracking-tight text-slate-950">
                @if (ch.type === 'private') {
                  <i class="pi pi-lock text-xs text-slate-500" aria-hidden="true"></i>
                } @else if (ch.type === 'dm') {
                  <i class="pi pi-user text-xs text-slate-500" aria-hidden="true"></i>
                } @else {
                  <span class="text-slate-500">#</span>
                }
                {{ ch.name }}
              </span>
            </div>
            @if (ch.description) {
              <p class="mt-0.5 truncate text-xs text-slate-500">{{ ch.description }}</p>
            }
            @if (ch.kind === 'project') {
              <p class="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
                <i class="pi pi-briefcase text-[9px]" aria-hidden="true"></i>
                Project channel
              </p>
            }
          </div>
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
              [class.bg-emerald-50]="realtimeConnected()"
              [class.text-emerald-700]="realtimeConnected()"
              [class.bg-amber-50]="!realtimeConnected()"
              [class.text-amber-700]="!realtimeConnected()"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                [class.bg-emerald-500]="realtimeConnected()"
                [class.bg-amber-500]="!realtimeConnected()"
              ></span>
              {{ realtimeConnected() ? 'Live' : 'Reconnecting' }}
            </span>
          </div>
        } @else {
          <div class="text-sm text-slate-500">Loading channel…</div>
        }
      </header>

      @if (!realtimeConnected()) {
        <div class="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-800">
          Reconnecting to chat realtime. New messages may arrive with delay.
        </div>
      }

      <!-- Messages list -->
      <div
        #scroller
        class="relative flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-1"
        (scroll)="onScroll()"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        @if (loadingMore()) {
          <div class="text-center text-xs text-slate-400 py-2">Loading earlier messages…</div>
        }
        @if (renderedMessages().length === 0 && !loadingInitial()) {
          <div class="flex h-full flex-col items-center justify-center text-center">
            <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <i class="pi pi-comments text-lg" aria-hidden="true"></i>
            </span>
            <p class="text-base font-bold text-slate-800">No messages yet</p>
            <p class="mt-1 text-sm text-slate-500">Send the first message to get this space moving.</p>
          </div>
        }

        @for (rm of renderedMessages(); track rm.message.id) {
          <article
            class="group flex gap-3 rounded-xl px-3 py-1 hover:bg-violet-50/60"
            [class.pl-10]="rm.indent"
          >
            <div class="w-9 shrink-0">
              @if (rm.showHeader) {
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  [style.background]="avatarBg(rm.message.authorId)"
                  [attr.aria-label]="'Author ' + rm.message.authorId"
                >
                  {{ initials(rm.message.authorId) }}
                </span>
              }
            </div>
            <div class="min-w-0 flex-1">
              @if (rm.showHeader) {
                <header class="flex items-baseline gap-2">
                  <span class="text-sm font-semibold text-slate-900">
                    {{ short(rm.message.authorId) }}
                  </span>
                  <span class="text-[10px] text-slate-400">
                    {{ time(rm.message.createdAt) }}
                  </span>
                  @if (rm.message.editedAt) {
                    <span class="text-[10px] text-slate-400">(edited)</span>
                  }
                  @if (rm.message.parentMessageId) {
                    <span class="text-[10px] text-violet-600">↳ reply</span>
                  }
                </header>
              }
              <div
                class="prose max-w-none text-sm leading-relaxed text-slate-700
                       [&_p]:my-1 [&_pre]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                [innerHTML]="renderBody(rm.message.body)"
              ></div>
              @if (rm.message.attachments.length) {
                <ul class="mt-1 flex flex-wrap gap-2">
                  @for (att of rm.message.attachments; track att.id) {
                    <li>
                      <a
                        [href]="att.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <i class="pi pi-paperclip text-[10px]" aria-hidden="true"></i>
                        {{ att.name }}
                      </a>
                    </li>
                  }
                </ul>
              }
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              @if (threadReplyCount(rm.message) > 0) {
                <button
                  type="button"
                  (click)="openThread(rm.message)"
                  class="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-200"
                >
                  <i class="pi pi-comment text-[9px]" aria-hidden="true"></i>
                  {{ threadReplyCount(rm.message) }} repl{{ threadReplyCount(rm.message) === 1 ? 'y' : 'ies' }}
                </button>
              }
            </div>
            <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  (click)="openThread(rm.message)"
                  class="rounded p-1 text-xs text-slate-500 hover:text-violet-700"
                  aria-label="Reply in thread"
                >
                  <i class="pi pi-comment" aria-hidden="true"></i>
                </button>
                @if (rm.message.authorId === currentUserId()) {
                <button
                  type="button"
                  (click)="onDelete(rm.message)"
                  class="rounded p-1 text-xs text-slate-500 hover:text-rose-600"
                  aria-label="Delete message"
                >
                  <i class="pi pi-trash" aria-hidden="true"></i>
                </button>
                }
              </div>
          </article>
        }
      </div>

      <!-- New-messages pill -->
      @if (showNewPill()) {
        <button
          type="button"
          (click)="scrollToBottom()"
          class="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg"
        >
          New messages ↓
        </button>
      }

      <!-- Typing indicator -->
      @if (typingUsers().length > 0) {
        <div class="px-5 py-1 text-xs text-slate-500">
          {{ typingLabel() }}
        </div>
      }

      <footer class="border-t border-slate-100 px-6 py-4 bg-white">
        <jt-message-input
          [placeholder]="inputPlaceholder()"
          (sent)="onSend($event)"
          (typingStart)="onTypingStart()"
          (typingStop)="onTypingStop()"
        />
      </footer>
      </div>

      @if (activeThreadRoot(); as root) {
        <aside class="flex w-[24rem] shrink-0 flex-col border-l border-slate-200 bg-slate-50">
          <header class="flex items-center justify-between border-b border-slate-200 px-4 py-4">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">Thread</p>
              <h3 class="text-sm font-black text-slate-950">Reply thread</h3>
            </div>
            <button
              type="button"
              (click)="closeThread()"
              class="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-800"
              aria-label="Close thread"
            >
              <i class="pi pi-times text-xs" aria-hidden="true"></i>
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-4 py-4">
            <article class="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <header class="flex items-baseline gap-2">
                <span class="text-sm font-semibold text-slate-900">{{ short(root.authorId) }}</span>
                <span class="text-[10px] text-slate-400">{{ time(root.createdAt) }}</span>
              </header>
              <div
                class="prose mt-2 max-w-none text-sm leading-relaxed text-slate-700 [&_p]:my-1"
                [innerHTML]="renderBody(root.body)"
              ></div>
            </article>

            <div class="mt-4 space-y-3">
              @for (reply of threadMessages(); track reply.id) {
                <article class="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <header class="flex items-baseline gap-2">
                    <span class="text-sm font-semibold text-slate-900">{{ short(reply.authorId) }}</span>
                    <span class="text-[10px] text-slate-400">{{ time(reply.createdAt) }}</span>
                  </header>
                  <div
                    class="prose mt-2 max-w-none text-sm leading-relaxed text-slate-700 [&_p]:my-1"
                    [innerHTML]="renderBody(reply.body)"
                  ></div>
                </article>
              } @empty {
                <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No replies yet.
                </div>
              }
            </div>
          </div>

          <footer class="border-t border-slate-200 bg-white px-4 py-4">
            <jt-message-input
              [placeholder]="'Reply in thread'"
              (sent)="onSendThreadReply($event)"
            />
          </footer>
        </aside>
      }
    </section>
  `,
})
export class ChatChannelViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly channelStore = inject(ChatChannelStore);
  private readonly messageStore = inject(ChatMessageStore);
  private readonly presenceStore = inject(ChatPresenceStore);
  private readonly chatApi = inject(ChatApiService);
  private readonly realtime = inject(ChatRealtimeService);
  private readonly auth = inject(AuthService);
  private readonly markdown = inject(MarkdownPipe);

  private readonly _channelId = signal<string | null>(null);
  readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

  readonly loadingInitial = signal(false);
  readonly loadingMore = signal(false);
  readonly showNewPill = signal(false);
  readonly activeThreadRoot = signal<ChatMessage | null>(null);
  private _isAtBottom = true;
  private _readTimer: ReturnType<typeof setTimeout> | null = null;
  private _disposers: Array<() => void> = [];
  private _routeSub: { unsubscribe: () => void } | null = null;

  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  readonly channel = computed(() => {
    const id = this._channelId();
    return id ? this.channelStore.byId()[id] ?? null : null;
  });

  readonly messages = computed<ChatMessage[]>(() => {
    const id = this._channelId();
    return id ? this.messageStore.byChannel()[id]?.list ?? [] : [];
  });

  readonly renderedMessages = computed<RenderedMessage[]>(() => {
    const msgs = this.messages();
    const out: RenderedMessage[] = [];
    let prev: ChatMessage | null = null;
    for (const m of msgs) {
      const grouped = shouldGroupWith(prev, m);
      out.push({
        message: m,
        showHeader: !grouped,
        indent: !!m.parentMessageId,
      });
      prev = m;
    }
    return out;
  });

  readonly threadMessages = computed<ChatMessage[]>(() => {
    const root = this.activeThreadRoot();
    if (!root) return [];
    return this.messages().filter(message => message.parentMessageId === root.id);
  });

  readonly typingUsers = computed(() => {
    const id = this._channelId();
    if (!id) return [];
    const me = this.currentUserId();
    return this.presenceStore
      .typingIn(id)()
      .filter(uid => uid !== me);
  });

  readonly typingLabel = computed(() => {
    const users = this.typingUsers();
    if (users.length === 0) return '';
    if (users.length === 1) return `${shortId(users[0])} is typing…`;
    if (users.length === 2)
      return `${shortId(users[0])} and ${shortId(users[1])} are typing…`;
    return 'Several people are typing…';
  });

  readonly inputPlaceholder = computed(() => {
    const ch = this.channel();
    return ch ? `Message ${ch.type === 'dm' ? '' : '#'}${ch.name}` : 'Write a message…';
  });

  readonly realtimeConnected = computed(() => this.realtime.connected());

  constructor() {
    // Keep scroll anchored to bottom on new messages when user was at bottom.
    effect(() => {
      this.renderedMessages();
      queueMicrotask(() => {
        if (this._isAtBottom) this.scrollToBottom();
        else this.showNewPill.set(true);
      });
    });
  }

  ngOnInit(): void {
    this._routeSub = this.route.paramMap.subscribe(p => {
      const id = p.get('channelId');
      if (id) this._switchChannel(id);
    });

    this._disposers.push(
      this.realtime.onMessageCreated(msg => {
        this.messageStore.upsert(msg);
        if (msg.channelId !== this._channelId()) {
          this.channelStore.incrementUnread(msg.channelId);
        } else if (this._isAtBottom) {
          this._scheduleRead();
        }
      }),
      this.realtime.onMessageEdited(msg => this.messageStore.upsert(msg)),
      this.realtime.onMessageDeleted(ev =>
        this.messageStore.remove(ev.channelId, ev.messageId),
      ),
      this.realtime.onTyping(ev =>
        this.presenceStore.setTyping(ev.channelId, ev.userId, ev.typing),
      ),
      this.realtime.onPresence(ev => this.presenceStore.setOnline(ev.userId, ev.online)),
    );
  }

  private async _switchChannel(id: string): Promise<void> {
    const prev = this._channelId();
    if (prev && prev !== id) this.realtime.leaveChannel(prev);
    this._channelId.set(id);
    this.realtime.joinChannel(id);
    this._isAtBottom = true;
    this.showNewPill.set(false);
    if (!this.channelStore.byId()[id]) {
      try {
        const ch = await this.chatApi.getChannel(id);
        this.channelStore.upsert(ch);
      } catch {
        /* ignore — channel header will show loading */
      }
    }
    if ((this.messageStore.byChannel()[id]?.list?.length ?? 0) === 0) {
      this.loadingInitial.set(true);
      try {
        await this.messageStore.loadInitial(id);
      } finally {
        this.loadingInitial.set(false);
      }
    }
    this.channelStore.clearUnread(id);
    this._scheduleRead();
  }

  onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    this._isAtBottom = distFromBottom < 80;
    if (this._isAtBottom) this.showNewPill.set(false);
    if (el.scrollTop < 100) {
      const id = this._channelId();
      if (id && !this.loadingMore() && this.messageStore.hasMore(id)) {
        this.loadingMore.set(true);
        void this.messageStore.loadMore(id).finally(() => this.loadingMore.set(false));
      }
    }
  }

  scrollToBottom(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    this._isAtBottom = true;
    this.showNewPill.set(false);
  }

  async onSend(body: string): Promise<void> {
    const channelId = this._channelId();
    if (!channelId) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const userId = this.currentUserId() || 'me';
    const optimistic: ChatMessage = {
      id: tempId,
      channelId,
      authorId: userId,
      body,
      parentMessageId: null,
      attachments: [],
      editedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.messageStore.upsert(optimistic);
    try {
      const real = await this.chatApi.sendMessage({ channelId, body });
      this.messageStore.replaceTemp(channelId, tempId, real);
      this._scheduleRead();
    } catch {
      // remove the optimistic message on failure
      this.messageStore.remove(channelId, tempId);
    }
  }

  openThread(message: ChatMessage): void {
    this.activeThreadRoot.set(message.parentMessageId
      ? this.messages().find(candidate => candidate.id === message.parentMessageId) ?? message
      : message);
  }

  closeThread(): void {
    this.activeThreadRoot.set(null);
  }

  async onSendThreadReply(body: string): Promise<void> {
    const root = this.activeThreadRoot();
    if (!root) return;
    const userId = this.currentUserId() || 'me';
    const tempId = `temp-thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: tempId,
      channelId: root.channelId,
      authorId: userId,
      body,
      parentMessageId: root.id,
      attachments: [],
      editedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.messageStore.upsert(optimistic);
    try {
      const real = await this.chatApi.sendMessage({
        channelId: root.channelId,
        body,
        parentMessageId: root.id,
      });
      this.messageStore.replaceTemp(root.channelId, tempId, real);
    } catch {
      this.messageStore.remove(root.channelId, tempId);
    }
  }

  async onDelete(message: ChatMessage): Promise<void> {
    try {
      await this.chatApi.deleteMessage(message.id);
      this.messageStore.remove(message.channelId, message.id);
    } catch {
      /* silent */
    }
  }

  onTypingStart(): void {
    const id = this._channelId();
    if (id) this.realtime.typingStart(id);
  }

  onTypingStop(): void {
    const id = this._channelId();
    if (id) this.realtime.typingStop(id);
  }

  avatarBg(userId: string): string {
    return `hsl(${hashHue(userId)}, 65%, 45%)`;
  }

  initials(userId: string): string {
    return initialsFor(userId);
  }

  time(iso: string): string {
    return formatTime(iso);
  }

  short(id: string): string {
    return shortId(id);
  }

  renderBody(body: string): string {
    return this.markdown.transform(body);
  }

  threadReplyCount(message: ChatMessage): number {
    const rootId = message.parentMessageId ?? message.id;
    return this.messages().filter(candidate => candidate.parentMessageId === rootId).length;
  }

  private _scheduleRead(): void {
    if (this._readTimer) clearTimeout(this._readTimer);
    this._readTimer = setTimeout(() => {
      const id = this._channelId();
      const msgs = this.messages();
      const last = msgs[msgs.length - 1];
      if (!id || !last || last.id.startsWith('temp-')) return;
      void this.chatApi.markAsRead(id, last.id).catch(() => undefined);
    }, 500);
  }

  ngOnDestroy(): void {
    const id = this._channelId();
    if (id) this.realtime.leaveChannel(id);
    for (const dispose of this._disposers) dispose();
    this._disposers = [];
    if (this._readTimer) clearTimeout(this._readTimer);
    this._routeSub?.unsubscribe();
  }
}
