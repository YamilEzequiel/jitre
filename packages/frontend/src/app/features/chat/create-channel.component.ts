import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatApiService, ChatChannel } from '../../stores/chat-api.service';

@Component({
  selector: 'jt-create-channel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-channel-title"
        (click)="onBackdrop($event)"
      >
        <div
          class="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl shadow-slate-950/20"
          (click)="$event.stopPropagation()"
        >
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">Spaces</p>
          <h2 id="create-channel-title" class="mb-1 mt-2 text-xl font-black text-slate-950">New space</h2>
          <p class="mb-6 text-sm text-slate-500">Create a home for a project or shared conversation.</p>

          <form (ngSubmit)="submit()" class="space-y-4">
            <label class="block">
              <span class="block text-xs font-semibold text-slate-600 mb-1">Name</span>
              <input
                type="text"
                name="name"
                [(ngModel)]="name"
                required
                minlength="2"
                maxlength="80"
                placeholder="e.g. design-feedback"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700
                       placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
                autofocus
              />
            </label>

            <label class="block">
              <span class="block text-xs font-semibold text-slate-600 mb-1">Description</span>
              <textarea
                name="description"
                [(ngModel)]="description"
                rows="2"
                maxlength="280"
                placeholder="Optional"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700
                       placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
              ></textarea>
            </label>

            <fieldset>
              <legend class="block text-xs font-semibold text-slate-600 mb-1">Type</legend>
              <div class="flex gap-3">
                <label class="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" name="type" value="public" [(ngModel)]="type" />
                  Public
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" name="type" value="private" [(ngModel)]="type" />
                  Private
                </label>
              </div>
            </fieldset>

            @if (error()) {
              <p role="alert" class="text-sm text-rose-400">{{ error() }}</p>
            }

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="cancel()"
                class="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="submitting() || !name().trim()"
                class="rounded-full px-5 py-2 text-sm font-bold text-white
                       bg-gradient-to-r from-indigo-600 to-violet-600
                       disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ submitting() ? 'Creating…' : 'Create' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class CreateChannelComponent {
  private readonly api = inject(ChatApiService);

  readonly open = input<boolean>(false);
  readonly created = output<ChatChannel>();
  readonly closed = output<void>();

  readonly name = signal('');
  readonly description = signal('');
  readonly type = signal<'public' | 'private'>('public');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }

  cancel(): void {
    this._reset();
    this.closed.emit();
  }

  async submit(): Promise<void> {
    const name = this.name().trim();
    if (!name) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const channel = await this.api.createChannel({
        name,
        description: this.description().trim() || undefined,
        type: this.type(),
      });
      this.created.emit(channel);
      this._reset();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      this.submitting.set(false);
    }
  }

  private _reset(): void {
    this.name.set('');
    this.description.set('');
    this.type.set('public');
    this.error.set(null);
  }
}
