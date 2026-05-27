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

  it('inline mode does not wrap output in <p>', () => {
    const result = pipe.transform('hello world', 'inline');
    expect(result.startsWith('<p>')).toBe(false);
    expect(result).toContain('hello world');
  });

  it('inline mode does not render block syntax (blockquote, headers)', () => {
    expect(pipe.transform('> quoted', 'inline')).not.toContain('<blockquote>');
    expect(pipe.transform('# heading', 'inline')).not.toContain('<h1>');
  });

  it('inline mode still renders bold, italic and code', () => {
    expect(pipe.transform('**b**', 'inline')).toContain('<strong>b</strong>');
    expect(pipe.transform('_i_', 'inline')).toContain('<em>i</em>');
    expect(pipe.transform('`x`', 'inline')).toContain('<code>x</code>');
  });
});
