import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export type MarkdownMode = 'block' | 'inline';

@Injectable()
@Pipe({ name: 'markdown', pure: true })
export class MarkdownPipe implements PipeTransform {
  transform(value: string, mode: MarkdownMode = 'block'): string {
    const raw = (mode === 'inline' ? marked.parseInline(value) : marked(value)) as string;
    return DOMPurify.sanitize(raw);
  }
}
