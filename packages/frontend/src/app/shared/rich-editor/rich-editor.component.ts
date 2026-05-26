import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorModule } from 'primeng/editor';

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
      (onTextChange)="handleTextChange($event)"
      [attr.data-testid]="'rich-editor'"
    ></p-editor>
  `,
})
export class RichEditorComponent {
  /** Current HTML value of the editor. Accepts `null` for empty state. */
  readonly value = input<string | null>(null);

  /** Placeholder shown while the editor is empty. */
  readonly placeholder = input<string>('Write something...');

  /** Renders the editor in read-only mode (toolbar hidden by Quill). */
  readonly readonly = input<boolean>(false);

  /** Minimum height for the content area. */
  readonly minHeight = input<string>('320px');

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
}
