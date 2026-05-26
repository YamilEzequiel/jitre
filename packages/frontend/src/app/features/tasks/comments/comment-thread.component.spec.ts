import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommentThreadComponent } from './comment-thread.component';
import { MarkdownPipe } from '../../../shared/markdown/markdown.pipe';

describe('CommentThreadComponent', () => {
  let fixture: ComponentFixture<CommentThreadComponent>;

  const mockComments = [
    { id: 'c1', body: '**Hello** world', authorId: 'u1', authorName: 'Alice', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'c2', body: 'Plain text', authorId: 'u2', authorName: 'Bob', createdAt: '2026-01-02T00:00:00Z' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MarkdownPipe] });
    fixture = TestBed.createComponent(CommentThreadComponent);
    fixture.componentRef.setInput('comments', mockComments);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders author names', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Bob');
  });

  it('emits reply event on reply button click', () => {
    const spy = vi.fn();
    fixture.componentInstance.reply.subscribe(spy);
    fixture.componentInstance.onReply('c1');
    expect(spy).toHaveBeenCalledWith('c1');
  });

  it('emits delete event on deleteComment call', () => {
    const spy = vi.fn();
    fixture.componentInstance.deleted.subscribe(spy);
    fixture.componentInstance.onDelete('c1');
    expect(spy).toHaveBeenCalledWith('c1');
  });
});
