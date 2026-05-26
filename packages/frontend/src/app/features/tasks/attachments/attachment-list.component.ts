import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ImageModule } from 'primeng/image';
import { ToastService } from '../../../core/toast/toast.service';
import {
  AttachmentApiService,
  AttachmentContext,
  AttachmentDto,
} from '../../../stores/attachment-api.service';

interface DisplayAttachment {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

@Component({
  selector: 'jt-attachment-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageModule],
  template: `
    <div>
      <!-- Header: title + upload trigger -->
      <div class="flex items-center justify-between gap-3 mb-3">
        <h3 class="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-600">
          <i class="pi pi-paperclip text-[12px] text-slate-400" aria-hidden="true"></i>
          Attachments
          <span class="text-slate-400 normal-case tracking-normal font-medium">({{ attachments().length }})</span>
        </h3>
        <label
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
                 text-blue-700 bg-blue-50 border border-blue-100
                 hover:bg-blue-100 hover:border-blue-200
                 cursor-pointer transition-colors
                 has-[input:disabled]:opacity-60 has-[input:disabled]:cursor-not-allowed"
        >
          <i class="pi pi-upload text-[11px]" aria-hidden="true"></i>
          {{ uploading() ? 'Uploading…' : 'Add files' }}
          <input
            type="file"
            multiple
            class="sr-only"
            (change)="onFilesSelected($event)"
            [disabled]="uploading()"
            accept="image/*,application/pdf,text/plain,text/csv,application/zip,application/json,.log,.txt"
            aria-label="Upload attachments"
          />
        </label>
      </div>

      <!-- Drop zone (only shown when empty so it doesn't bury existing files) -->
      @if (attachments().length === 0 && !uploading()) {
        <label
          class="block rounded-xl border border-dashed border-slate-300 bg-slate-50/50
                 px-6 py-10 text-center cursor-pointer
                 hover:bg-blue-50/50 hover:border-blue-300 transition-colors"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          [class.bg-blue-50]="dragging()"
          [class.border-blue-400]="dragging()"
        >
          <input
            type="file"
            multiple
            class="sr-only"
            (change)="onFilesSelected($event)"
            accept="image/*,application/pdf,text/plain,text/csv,application/zip,application/json,.log,.txt"
            aria-label="Upload attachments"
          />
          <i class="pi pi-cloud-upload text-2xl text-slate-400 mb-2 block" aria-hidden="true"></i>
          <p class="text-sm font-semibold text-slate-700">Drop files here or click to upload</p>
          <p class="text-[11px] text-slate-400 mt-1">Images, PDFs, text — up to 25 MB each</p>
        </label>
      }

      @if (uploading()) {
        <div
          class="w-full h-1 mb-3 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Uploading…"
        >
          <div class="h-full w-1/2 rounded-full bg-blue-500 animate-pulse"></div>
        </div>
      }

      <!-- Gallery grid -->
      @if (attachments().length > 0) {
        <div
          class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
        >
          @for (att of attachments(); track att.id) {
            <div
              class="group relative rounded-lg border border-slate-200 bg-slate-50/60
                     overflow-hidden hover:border-slate-300 transition-colors"
            >
              @if (isImage(att.mimeType)) {
                <p-image
                  [src]="att.url"
                  [alt]="att.filename"
                  [preview]="true"
                  styleClass="block w-full attachment-thumb"
                  imageClass="w-full h-28 object-cover cursor-zoom-in"
                />
              } @else {
                <a
                  [href]="att.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex h-28 items-center justify-center bg-white"
                  [attr.aria-label]="'Open ' + att.filename"
                >
                  <i [class]="'pi ' + iconFor(att.mimeType) + ' text-3xl text-slate-300'" aria-hidden="true"></i>
                </a>
              }
              <div class="flex items-center gap-2 p-2">
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-semibold text-slate-700 truncate" [title]="att.filename">
                    {{ att.filename }}
                  </p>
                  <p class="text-[10px] text-slate-400">{{ formatSize(att.size) }}</p>
                </div>
                <a
                  [href]="att.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400
                         hover:text-blue-600 hover:bg-blue-50 transition-colors
                         opacity-0 group-hover:opacity-100"
                  [attr.aria-label]="'Download ' + att.filename"
                  title="Download"
                >
                  <i class="pi pi-download text-[11px]" aria-hidden="true"></i>
                </a>
                <button
                  type="button"
                  (click)="onDelete(att)"
                  class="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400
                         hover:text-rose-600 hover:bg-rose-50 transition-colors
                         opacity-0 group-hover:opacity-100"
                  [attr.aria-label]="'Delete ' + att.filename"
                  title="Delete"
                >
                  <i class="pi pi-trash text-[11px]" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .attachment-thumb img {
        display: block;
      }
    `,
  ],
})
export class AttachmentListComponent implements OnInit {
  readonly context = input.required<AttachmentContext>();
  readonly contextId = input.required<string>();

  private readonly api = inject(AttachmentApiService);
  private readonly toast = inject(ToastService);

  readonly attachments = signal<DisplayAttachment[]>([]);
  readonly loading = signal(false);
  readonly uploading = signal(false);
  readonly dragging = signal(false);

  constructor() {
    // Re-hydrate when the contextId input changes (e.g. user navigates between tasks).
    effect(() => {
      const id = this.contextId();
      const ctx = this.context();
      if (!id || !ctx) return;
      void this.hydrate();
    });
  }

  ngOnInit(): void {
    void this.hydrate();
  }

  private async hydrate(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.api.list({
        context: this.context(),
        contextId: this.contextId(),
      });
      this.attachments.set(
        rows.map(att => this.toDisplay(att, att.signedUrl ?? '')),
      );
    } catch {
      this.attachments.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  isImage(mime: string): boolean {
    return mime.startsWith('image/');
  }

  iconFor(mime: string): string {
    if (mime.includes('pdf')) return 'pi-file-pdf';
    if (mime.includes('zip') || mime.includes('compressed')) return 'pi-folder';
    if (mime.startsWith('text/') || mime.includes('json')) return 'pi-file-edit';
    return 'pi-file';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  onFilesSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = Array.from(inputEl.files ?? []);
    if (files.length === 0) return;
    void this.uploadAll(files).finally(() => {
      inputEl.value = '';
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.types.includes('Files')) this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    void this.uploadAll(files);
  }

  async onDelete(att: DisplayAttachment): Promise<void> {
    if (!confirm(`Delete "${att.filename}"?`)) return;
    try {
      await this.api.delete(att.id);
      this.attachments.update(xs => xs.filter(x => x.id !== att.id));
      this.toast.success('Attachment deleted');
    } catch {
      this.toast.error('Delete failed');
    }
  }

  private async uploadAll(files: File[]): Promise<void> {
    this.uploading.set(true);
    try {
      for (const file of files) {
        try {
          const att = await this.api.upload({
            file,
            context: this.context(),
            contextId: this.contextId(),
          });
          const download = await this.api.download(att.id);
          this.attachments.update(xs => [...xs, this.toDisplay(att, download.signedUrl)]);
        } catch {
          this.toast.error(`Upload failed: ${file.name}`);
        }
      }
      this.toast.success(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`);
    } finally {
      this.uploading.set(false);
    }
  }

  private toDisplay(att: AttachmentDto, url: string): DisplayAttachment {
    return {
      id: att.id,
      filename: att.originalFilename,
      url,
      mimeType: att.mimeType,
      size: att.sizeBytes,
    };
  }
}
