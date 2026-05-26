import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorModule } from 'primeng/editor';
import {
  AttachmentApiService,
  AttachmentContext,
} from '../../stores/attachment-api.service';
import { ToastService } from '../../core/toast/toast.service';

/**
 * Payload emitted by p-editor when the user changes the content.
 * We forward this verbatim so callers can pick `htmlValue` or `delta`
 * depending on how they want to persist the document.
 */
export interface RichEditorChangeEvent {
  htmlValue: string | null;
  textValue: string;
  delta: unknown;
}

/** Minimal Quill surface we lean on. PrimeNG types Quill as `any`. */
interface QuillLike {
  getModule(name: string): {
    addHandler?(name: string, handler: () => void): void;
  } | null;
  getSelection(focus?: boolean): { index: number; length: number } | null;
  insertEmbed(index: number, type: string, value: unknown, source?: string): void;
  setSelection(index: number, length: number, source?: string): void;
  root: HTMLElement;
}

/**
 * Thin wrapper around PrimeNG's <p-editor> (Quill 2 under the hood).
 *
 * Goals:
 *  - Single point of integration for the dark glass aesthetic.
 *  - Sensible default toolbar (headers, marks, lists, link, code, image).
 *  - Two-way friendly: callers can use [value]/(valueChange) or grab the
 *    full event via (changed) when they need the Quill Delta too.
 *
 * Styling overrides for .ql-* selectors live in `styles.css` because
 * Quill renders its toolbar in the global DOM and view encapsulation
 * would scope them away.
 */
@Component({
  selector: 'jt-rich-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorModule, FormsModule],
  template: `
    <p-editor
      [ngModel]="value() ?? ''"
      [placeholder]="placeholder()"
      [readonly]="readonly()"
      [style]="containerStyle()"
      (onInit)="handleInit($event)"
      (onTextChange)="handleTextChange($event)"
      [attr.data-testid]="'rich-editor'"
    ></p-editor>
  `,
})
export class RichEditorComponent {
  private readonly attachments = inject(AttachmentApiService);
  private readonly toast = inject(ToastService);

  /** Current HTML value of the editor. Accepts `null` for empty state. */
  readonly value = input<string | null>(null);

  /** Placeholder shown while the editor is empty. */
  readonly placeholder = input<string>('Write something...');

  /** Renders the editor in read-only mode (toolbar hidden by Quill). */
  readonly readonly = input<boolean>(false);

  /** Minimum height for the content area. */
  readonly minHeight = input<string>('320px');

  /** Upload context for embedded images (e.g. 'task', 'project'). */
  readonly uploadContext = input<AttachmentContext>('project');

  /** Optional contextId (task id, project id, etc.) sent with each upload. */
  readonly uploadContextId = input<string | undefined>(undefined);

  /** Emitted with the new HTML payload whenever the user edits. */
  readonly valueChange = output<string | null>();

  /** Emitted with the full Quill event (htmlValue, textValue, delta). */
  readonly changed = output<RichEditorChangeEvent>();

  protected readonly containerStyle = computed<Record<string, string>>(() => ({
    height: this.minHeight(),
  }));

  protected handleTextChange(event: RichEditorChangeEvent): void {
    this.valueChange.emit(event.htmlValue);
    this.changed.emit(event);
  }

  protected handleInit(event: { editor: QuillLike }): void {
    const quill = event.editor;

    // Replace Quill's default image button: open a file picker, upload to
    // the backend, then insert the signed URL — instead of inlining base64.
    const toolbar = quill.getModule('toolbar');
    toolbar?.addHandler?.('image', () => this.openImagePicker(quill));

    // Catch pasted/dropped image files and upload them too.
    quill.root.addEventListener('paste', evt =>
      this.handlePasteOrDrop(quill, (evt as ClipboardEvent).clipboardData),
    );
    quill.root.addEventListener('drop', evt => {
      evt.preventDefault();
      this.handlePasteOrDrop(quill, (evt as DragEvent).dataTransfer);
    });
  }

  private openImagePicker(quill: QuillLike): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void this.uploadAndInsert(quill, file);
    };
    input.click();
  }

  private handlePasteOrDrop(
    quill: QuillLike,
    transfer: DataTransfer | null,
  ): void {
    if (!transfer?.files?.length) return;
    for (const file of Array.from(transfer.files)) {
      if (file.type.startsWith('image/')) {
        void this.uploadAndInsert(quill, file);
      }
    }
  }

  private async uploadAndInsert(quill: QuillLike, file: File): Promise<void> {
    try {
      const { url } = await this.attachments.uploadImage({
        file,
        context: this.uploadContext(),
        contextId: this.uploadContextId(),
      });
      const selection = quill.getSelection(true) ?? { index: 0, length: 0 };
      quill.insertEmbed(selection.index, 'image', url, 'user');
      quill.setSelection(selection.index + 1, 0, 'user');
    } catch {
      this.toast.error('Image upload failed');
    }
  }
}
