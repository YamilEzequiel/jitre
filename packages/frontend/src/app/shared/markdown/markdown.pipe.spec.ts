import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MarkdownPipe] });
    pipe = TestBed.inject(MarkdownPipe);
  });

  it('converts markdown to HTML', () => {
    const result = pipe.transform('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('strips script tags via DOMPurify', () => {
    const dirty = '<script>alert("xss")</script>Hello';
    const result = pipe.transform(dirty);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });
});
