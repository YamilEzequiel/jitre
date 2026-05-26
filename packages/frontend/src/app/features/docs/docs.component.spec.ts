import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { DocsComponent } from './docs.component';
import { DocumentStore } from '../../stores/document.store';
import { ToastService } from '../../core/toast/toast.service';
import { Document } from '../../stores/document-api.service';

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: 'r1',
    workspaceId: 'ws1',
    projectId: null,
    parentId: null,
    title: 'Root',
    icon: null,
    content: {},
    contentText: '',
    order: 0,
    creatorUserId: 'u1',
    lastEditedByUserId: 'u1',
    lastEditedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    children: [],
    ...over,
  };
}

describe('DocsComponent', () => {
  let fixture: ComponentFixture<DocsComponent>;
  let storeMock: {
    tree: ReturnType<typeof signal<Document[]>>;
    byId: ReturnType<typeof signal<Record<string, Document>>>;
    loading: ReturnType<typeof signal<boolean>>;
    loadTree: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn>; events: Subject<unknown> };

  beforeEach(() => {
    storeMock = {
      tree: signal<Document[]>([]),
      byId: signal<Record<string, Document>>({}),
      loading: signal(false),
      loadTree: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      move: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };
    routerMock = { navigate: vi.fn(), events: new Subject<unknown>() };

    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentStore, useValue: storeMock },
        { provide: ToastService, useValue: toastMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            firstChild: null,
            children: [],
            snapshot: { paramMap: { get: () => null } },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(DocsComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('creates and loads tree on init', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(storeMock.loadTree).toHaveBeenCalled();
  });

  it('renders empty state when no docs', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No document selected');
    expect(el.textContent).toContain('Create your first doc');
  });

  it('renders docs in the sidebar when the store has roots', () => {
    storeMock.tree.set([makeDoc({ title: 'First' })]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('First');
  });

  it('selectDoc navigates to /docs/:id', () => {
    const comp = fixture.componentInstance as unknown as {
      selectDoc: (id: string) => void;
    };
    comp.selectDoc('abc');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/docs', 'abc']);
  });

  it('creates an editable Untitled page immediately without a native prompt', async () => {
    const promptSpy = vi.spyOn(globalThis, 'prompt');
    storeMock.create.mockResolvedValue(makeDoc({ id: 'new1', title: 'Untitled' }));

    const comp = fixture.componentInstance as unknown as {
      createDoc: (parentId: string | null) => Promise<void>;
    };
    await comp.createDoc(null);

    expect(promptSpy).not.toHaveBeenCalled();
    expect(storeMock.create).toHaveBeenCalledWith({ title: 'Untitled', parentId: null });
    expect(routerMock.navigate).toHaveBeenCalledWith(['/docs', 'new1']);
    expect(toastMock.success).toHaveBeenCalledWith('Page created');
  });

  it('opens the selected page for inline rename instead of prompting', () => {
    const promptSpy = vi.spyOn(globalThis, 'prompt');
    const comp = fixture.componentInstance as unknown as {
      onTreeAction: (e: { type: 'rename'; doc: Document }) => void;
    };

    comp.onTreeAction({ type: 'rename', doc: makeDoc({ id: 'rename-me' }) });

    expect(promptSpy).not.toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/docs', 'rename-me']);
  });

  it('can expose the page navigation drawer on small screens', () => {
    const comp = fixture.componentInstance as unknown as {
      mobileNavOpen: () => boolean;
      openMobileNav: () => void;
      closeMobileNav: () => void;
    };

    comp.openMobileNav();
    expect(comp.mobileNavOpen()).toBe(true);
    comp.closeMobileNav();
    expect(comp.mobileNavOpen()).toBe(false);
  });

  it('deleteDoc skips when user declines confirm', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const comp = fixture.componentInstance as unknown as {
      deleteDoc: (doc: Document) => Promise<void>;
    };

    await comp.deleteDoc(makeDoc({ id: 'r1' }));

    expect(storeMock.delete).not.toHaveBeenCalled();
  });

  it('deleteDoc removes the doc and toasts on success', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    storeMock.delete.mockResolvedValue(undefined);

    const comp = fixture.componentInstance as unknown as {
      deleteDoc: (doc: Document) => Promise<void>;
    };
    await comp.deleteDoc(makeDoc({ id: 'r1' }));

    expect(storeMock.delete).toHaveBeenCalledWith('r1');
    expect(toastMock.success).toHaveBeenCalledWith('Page deleted');
  });

  it('onTreeAction routes select intent to navigation', () => {
    const comp = fixture.componentInstance as unknown as {
      onTreeAction: (e: { type: 'select'; doc: Document }) => void;
    };
    comp.onTreeAction({ type: 'select', doc: makeDoc({ id: 'pick' }) });
    expect(routerMock.navigate).toHaveBeenCalledWith(['/docs', 'pick']);
  });

  it('onDropped prevents move into own subtree', async () => {
    storeMock.tree.set([
      makeDoc({ id: 'A', children: [makeDoc({ id: 'B', parentId: 'A' })] }),
    ]);
    fixture.detectChanges();

    const comp = fixture.componentInstance as unknown as {
      onDropped: (e: { draggedId: string; targetParentId: string | null; targetOrder: number }) => Promise<void>;
    };
    await comp.onDropped({ draggedId: 'A', targetParentId: 'B', targetOrder: 0 });

    expect(storeMock.move).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith('Cannot move a page into its own subtree');
  });

  it('onDropped delegates to store.move and reloads the tree', async () => {
    storeMock.move.mockResolvedValue(makeDoc({ id: 'X', parentId: 'Y' }));
    const comp = fixture.componentInstance as unknown as {
      onDropped: (e: { draggedId: string; targetParentId: string | null; targetOrder: number }) => Promise<void>;
    };
    await comp.onDropped({ draggedId: 'X', targetParentId: 'Y', targetOrder: 0 });

    expect(storeMock.move).toHaveBeenCalledWith('X', { parentId: 'Y', order: 0 });
    // loadTree is called once on init + once after move
    expect(storeMock.loadTree.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
