import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Injectable()
@Pipe({ name: 'markdown', pure: true })
export class MarkdownPipe implements PipeTransform {
  transform(value: string): string {
    const raw = marked(value) as string;
    return DOMPurify.sanitize(raw);
  }
}
