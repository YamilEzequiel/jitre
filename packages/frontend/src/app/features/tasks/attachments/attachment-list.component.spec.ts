import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AttachmentListComponent } from './attachment-list.component';
import { AttachmentApiService } from '../../../stores/attachment-api.service';
import { ToastService } from '../../../core/toast/toast.service';

describe('AttachmentListComponent', () => {
  let fixture: ComponentFixture<AttachmentListComponent>;
  let apiMock: {
    upload: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = {
      upload: vi.fn().mockResolvedValue({
        id: 'a1',
        workspaceId: 'ws1',
        context: 'task',
        contextId: 't1',
        uploadedByUserId: 'u1',
        storageKey: 'ws1/task/t1/a1',
        originalFilename: 'design.png',
        mimeType: 'image/png',
        sizeBytes: 12000,
        checksum: null,
        createdAt: new Date().toISOString(),
      }),
      download: vi.fn().mockResolvedValue({
        driver: 'local',
        attachment: {},
        signedUrl: '/api/v1/files/ws1/task/t1/a1?token=t&exp=1',
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AttachmentApiService, useValue: apiMock },
        { provide: ToastService, useValue: toastMock },
      ],
    });

    fixture = TestBed.createComponent(AttachmentListComponent);
    fixture.componentRef.setInput('context', 'task');
    fixture.componentRef.setInput('contextId', 't1');
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows empty state when no attachments uploaded yet', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No attachments yet.');
  });

  it('isImage returns true for image/* content types', () => {
    const comp = fixture.componentInstance;
    expect(comp.isImage('image/png')).toBe(true);
    expect(comp.isImage('application/pdf')).toBe(false);
  });

  it('formatSize formats bytes', () => {
    const comp = fixture.componentInstance;
    expect(comp.formatSize(500)).toBe('500 B');
    expect(comp.formatSize(2048)).toBe('2.0 KB');
    expect(comp.formatSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
