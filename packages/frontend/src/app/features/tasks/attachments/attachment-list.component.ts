import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  contentType: string;
  size: number;
}

@Component({
  selector: 'jt-attachment-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex items-center justify-between mb-4">
        <h3
          class="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
        >
          Attachments
          <span class="text-slate-400 normal-case tracking-normal">({{ attachments().length }})</span>
        </h3>
        <label
          class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700
                 bg-white border border-slate-200 backdrop-blur-sm cursor-pointer
                 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700
                 transition-colors"
        >
          <svg
            class="h-3.5 w-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
          <input
            type="file"
            class="sr-only"
            (change)="onFileSelected($event)"
            [attr.aria-label]="'Upload attachment for task'"
          />
        </label>
      </div>

      @if (uploading()) {
        <div
          class="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden"
          role="progressbar"
          aria-label="Uploading…"
        >
          <div
            class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500
                   shadow-md shadow-indigo-500/30 w-1/2 animate-pulse"
          ></div>
        </div>
      }

      <div class="space-y-2">
        @for (att of attachments(); track att.id) {
          <div
            class="flex items-center gap-3 p-3 rounded-xl
                   border border-slate-200 bg-white backdrop-blur-sm
                   hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            @if (isImage(att.contentType)) {
              <img
                [src]="att.url"
                [alt]="att.filename"
                class="w-10 h-10 object-cover rounded-lg border border-slate-200"
              />
            } @else {
              <div
                class="w-10 h-10 flex items-center justify-center rounded-lg
                       bg-gradient-to-br from-indigo-500 to-violet-600"
              >
                <svg
                  class="h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            }
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-950 truncate">{{ att.filename }}</p>
              <p class="text-[11px] text-slate-400">{{ formatSize(att.size) }}</p>
            </div>
            <a
              [href]="att.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs font-semibold text-violet-700 hover:text-violet-800 transition-colors"
              [attr.aria-label]="'Download ' + att.filename"
            >
              Download
            </a>
          </div>
        } @empty {
          <p class="text-sm text-slate-500">No attachments.</p>
        }
      </div>
    </div>
  `,
})
export class AttachmentListComponent {
  readonly taskId = input.required<string>();
  readonly attachments = input<Attachment[]>([]);
  readonly uploaded = output<Attachment>();

  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  readonly uploading = signal(false);

  isImage(contentType: string): boolean {
    return contentType.startsWith('image/');
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'task');
      formData.append('contextId', this.taskId());
      const att = await firstValueFrom(
        this.http.post<Attachment>('/api/v1/attachments', formData),
      );
      this.uploaded.emit(att);
      this.toast.success('File uploaded');
    } catch {
      this.toast.error('Upload failed');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
}
