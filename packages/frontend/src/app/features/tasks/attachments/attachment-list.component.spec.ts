import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AttachmentListComponent } from './attachment-list.component';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../../core/toast/toast.service';

describe('AttachmentListComponent', () => {
  let fixture: ComponentFixture<AttachmentListComponent>;
  let httpMock: { post: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const mockAttachments = [
    { id: 'a1', filename: 'design.png', url: '/files/design.png', contentType: 'image/png', size: 12000 },
    { id: 'a2', filename: 'notes.pdf', url: '/files/notes.pdf', contentType: 'application/pdf', size: 5000 },
  ];

  beforeEach(() => {
    httpMock = { post: vi.fn() };
    toastMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: httpMock },
        { provide: ToastService, useValue: toastMock },
      ],
    });

    fixture = TestBed.createComponent(AttachmentListComponent);
    fixture.componentRef.setInput('taskId', 't1');
    fixture.componentRef.setInput('attachments', mockAttachments);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders attachment filenames', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('design.png');
    expect(el.textContent).toContain('notes.pdf');
  });

  it('isImage returns true for image/* content types', () => {
    const comp = fixture.componentInstance;
    expect(comp.isImage('image/png')).toBe(true);
    expect(comp.isImage('application/pdf')).toBe(false);
  });
});
