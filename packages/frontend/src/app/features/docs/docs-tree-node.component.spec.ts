import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DocsTreeNodeComponent, DocsTreeNodeAction, DocsDropEvent } from './docs-tree-node.component';
import { Document } from '../../stores/document-api.service';

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: 'd1',
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

describe('DocsTreeNodeComponent', () => {
  let fixture: ComponentFixture<DocsTreeNodeComponent>;
  let comp: DocsTreeNodeComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DocsTreeNodeComponent] });
    fixture = TestBed.createComponent(DocsTreeNodeComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('doc', makeDoc());
    fixture.detectChanges();
  });

  it('renders the title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Root');
  });

  it('renders nested children when present and expanded', () => {
    const child = makeDoc({ id: 'c1', parentId: 'd1', title: 'Child A' });
    fixture.componentRef.setInput('doc', makeDoc({ children: [child] }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Child A');
    expect(el.textContent).toContain('▶');
    expect(el.textContent).not.toMatch(/â|ð|Â/);
  });

  it('emits select action when the title is clicked', () => {
    const actions: DocsTreeNodeAction[] = [];
    comp.action.subscribe(a => actions.push(a));

    const button = fixture.nativeElement.querySelector('button.flex-1') as HTMLButtonElement;
    button.click();

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('select');
    expect(actions[0].doc.id).toBe('d1');
  });

  it('marks aria-current=page when this node is selected', () => {
    fixture.componentRef.setInput('selectedId', 'd1');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.flex-1') as HTMLButtonElement;
    expect(button.getAttribute('aria-current')).toBe('page');
  });

  it('renders a chevron button only when there are children', () => {
    // The kebab button also carries aria-expanded; select by its aria-label
    // prefix instead to isolate the chevron toggle.
    const findChevron = (): HTMLButtonElement | null =>
      Array.from(
        fixture.nativeElement.querySelectorAll('button[aria-expanded]') as NodeListOf<HTMLButtonElement>,
      ).find(b => /^(Expand|Collapse) /.test(b.getAttribute('aria-label') ?? '')) ?? null;

    expect(findChevron()).toBeNull();

    fixture.componentRef.setInput(
      'doc',
      makeDoc({ children: [makeDoc({ id: 'kid', parentId: 'd1' })] }),
    );
    fixture.detectChanges();
    expect(findChevron()).not.toBeNull();
  });

  it('emits drop event with the dragged id and this node as parent', () => {
    const drops: DocsDropEvent[] = [];
    comp.dropped.subscribe(d => drops.push(d));

    // Simulate dataTransfer via a plain object
    const dataMap: Record<string, string> = { 'text/plain': 'dragged-9' };
    const event = new Event('drop', { bubbles: true }) as unknown as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        getData: (k: string) => dataMap[k] ?? '',
        setData: (k: string, v: string) => { dataMap[k] = v; },
        dropEffect: 'move',
        effectAllowed: 'move',
      },
    });
    Object.defineProperty(event, 'preventDefault', { value: () => {}, writable: true });

    (comp as unknown as { onDrop: (e: DragEvent) => void }).onDrop(event);

    expect(drops).toHaveLength(1);
    expect(drops[0].draggedId).toBe('dragged-9');
    expect(drops[0].targetParentId).toBe('d1');
    expect(drops[0].targetOrder).toBe(0);
  });

  it('ignores drop when source equals target', () => {
    const drops: DocsDropEvent[] = [];
    comp.dropped.subscribe(d => drops.push(d));

    const event = new Event('drop') as unknown as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: { getData: () => 'd1' },
    });
    Object.defineProperty(event, 'preventDefault', { value: () => {} });

    (comp as unknown as { onDrop: (e: DragEvent) => void }).onDrop(event);

    expect(drops).toHaveLength(0);
  });
});
