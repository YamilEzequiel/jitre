import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { DocViewComponent } from './doc-view.component';
import { DocumentStore } from '../../stores/document.store';
import { ToastService } from '../../core/toast/toast.service';
import { Document } from '../../stores/document-api.service';

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: 'd1',
    workspaceId: 'ws1',
    projectId: null,
    parentId: null,
    title: 'Hello',
    icon: '📄',
    content: { html: '<p>hi</p>' },
    contentText: 'hi',
    order: 0,
    creatorUserId: 'u1',
    lastEditedByUserId: 'editor-abc-1234',
    lastEditedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [],
    ...over,
  };
}

describe('DocViewComponent', () => {
  let fixture: ComponentFixture<DocViewComponent>;
  let store: {
    byId: ReturnType<typeof signal<Record<string, Document>>>;
    loadById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  const paramMap$ = new Subject<ReturnType<typeof convertToParamMap>>();
  const routerMock = { navigate: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    store = {
      byId: signal<Record<string, Document>>({ d1: makeDoc() }),
      loadById: vi.fn().mockResolvedValue(makeDoc()),
      update: vi.fn().mockResolvedValue(makeDoc()),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentStore, useValue: store },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() },
        },
      ],
    });

    fixture = TestBed.createComponent(DocViewComponent);
    fixture.detectChanges();
    paramMap$.next(convertToParamMap({ id: 'd1' }));
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
    routerMock.navigate.mockReset();
  });

  it('renders the doc title in the editable header', () => {
    const input = fixture.nativeElement.querySelector('input[aria-label="Document title"]') as HTMLInputElement;
    expect(input.value).toBe('Hello');
  });

  it('debounces title input and persists after 1500ms', async () => {
    const comp = fixture.componentInstance as unknown as {
      onTitleInput: (e: Event) => void;
    };
    const synthetic = { target: { value: 'New Name' } } as unknown as Event;
    comp.onTitleInput(synthetic);

    expect(store.update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    expect(store.update).toHaveBeenCalledWith('d1', { title: 'New Name' });
  });

  it('flushTitle saves immediately on blur', async () => {
    const comp = fixture.componentInstance as unknown as {
      titleDraft: { set: (v: string) => void };
      flushTitle: () => Promise<void>;
    };
    comp.titleDraft.set('Edited');
    await comp.flushTitle();

    expect(store.update).toHaveBeenCalledWith('d1', { title: 'Edited' });
  });

  it('flushTitle is a no-op when title is unchanged', async () => {
    const comp = fixture.componentInstance as unknown as {
      flushTitle: () => Promise<void>;
    };
    await comp.flushTitle();
    expect(store.update).not.toHaveBeenCalled();
  });

  it('normalizes an empty title to Untitled on blur', async () => {
    const comp = fixture.componentInstance as unknown as {
      titleDraft: { set: (v: string) => void; (): string };
      flushTitle: () => Promise<void>;
    };
    comp.titleDraft.set('   ');
    await comp.flushTitle();

    expect(comp.titleDraft()).toBe('Untitled');
    expect(store.update).toHaveBeenCalledWith('d1', { title: 'Untitled' });
  });

  it('debounces editor changes and persists the delta', async () => {
    const comp = fixture.componentInstance as unknown as {
      onEditorChanged: (e: { htmlValue: string | null; textValue: string; delta: unknown }) => void;
    };
    comp.onEditorChanged({
      htmlValue: '<p>fresh</p>',
      textValue: 'fresh',
      delta: { ops: [{ insert: 'fresh' }] },
    });

    expect(store.update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    expect(store.update).toHaveBeenCalledWith('d1', {
      content: {
        ops: [{ insert: 'fresh' }],
        html: '<p>fresh</p>',
      },
    });
  });

  it('onIconChange persists the new icon when it differs', async () => {
    const comp = fixture.componentInstance as unknown as {
      onIconChange: (icon: string | null) => void;
    };
    comp.onIconChange('🚀');
    // No timers — icon change is immediate
    await Promise.resolve();
    expect(store.update).toHaveBeenCalledWith('d1', { icon: '🚀' });
  });

  it('hydrates legacy Delta content instead of rendering a blank page', () => {
    const comp = fixture.componentInstance as unknown as {
      deltaToHtml: (content: Record<string, unknown>) => string | null;
    };

    const html = comp.deltaToHtml({
      ops: [{ insert: 'Hello <team>\nSecond line\n' }],
    });

    expect(html).toBe('<p>Hello &lt;team&gt;</p><p>Second line</p>');
  });

  it('flushes pending content to the current page before navigating to another doc', async () => {
    store.byId.set({
      d1: makeDoc({ id: 'd1' }),
      d2: makeDoc({ id: 'd2', title: 'Second' }),
    });
    const comp = fixture.componentInstance as unknown as {
      onEditorChanged: (e: { htmlValue: string | null; textValue: string; delta: unknown }) => void;
    };
    comp.onEditorChanged({
      htmlValue: '<p>draft from first</p>',
      textValue: 'draft from first',
      delta: { ops: [{ insert: 'draft from first' }] },
    });

    paramMap$.next(convertToParamMap({ id: 'd2' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.update).toHaveBeenCalledWith('d1', {
      content: {
        ops: [{ insert: 'draft from first' }],
        html: '<p>draft from first</p>',
      },
    });
  });

  it('onDelete asks for confirmation and navigates away', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const comp = fixture.componentInstance as unknown as {
      onDelete: () => Promise<void>;
    };
    await comp.onDelete();
    expect(store.delete).toHaveBeenCalledWith('d1');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/docs']);
  });

  it('builds a breadcrumb chain from parent links', () => {
    const parent = makeDoc({ id: 'p', title: 'Parent', parentId: null });
    const current = makeDoc({ id: 'd1', title: 'Child', parentId: 'p' });
    store.byId.set({ p: parent, d1: current });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Parent');
    expect(el.textContent).toContain('Child');
  });
});
