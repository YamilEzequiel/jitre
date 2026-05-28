import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { OrgChartComponent } from './org-chart.component';
import {
  OrgGraph,
  OrgGraphApiService,
} from '../../../stores/org-graph-api.service';
import { EmployeeApiService } from '../../../stores/employee-api.service';
import { AreaStore } from '../../../stores/area.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';

const buildGraph = (nodeCount: number, edges: [number, number][]): OrgGraph => ({
  nodes: Array.from({ length: nodeCount }).map((_, i) => ({
    id: `u${i + 1}`,
    displayName: `User ${i + 1}`,
    email: `u${i + 1}@test.com`,
    avatarUrl: null,
    jobTitle: null,
    role: 'member' as const,
  })),
  edges: edges.map(([from, to]) => ({ from: `u${from}`, to: `u${to}` })),
});

describe('OrgChartComponent', () => {
  let fixture: ComponentFixture<OrgChartComponent>;
  let apiMock: { getOrgGraph: ReturnType<typeof vi.fn> };

  const configure = (graph: OrgGraph): void => {
    apiMock = {
      getOrgGraph: vi.fn().mockResolvedValue(graph),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: OrgGraphApiService, useValue: apiMock },
        {
          provide: EmployeeApiService,
          useValue: { list: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: AreaStore,
          useValue: {
            areas: signal([]).asReadonly(),
            byId: signal({} as Record<string, unknown>).asReadonly(),
            load: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), error: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id: 'me',
              email: 'me@test.com',
              displayName: 'Me',
              role: 'admin',
            }).asReadonly(),
            currentWorkspace: signal({
              id: 'ws-1',
              name: 'WS',
              slug: 'ws',
              role: 'owner',
            }).asReadonly(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(OrgChartComponent);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('renders all nodes from the graph', async () => {
    // 3 people, no relations → all sit in the "Sin asignar" group.
    configure(buildGraph(3, []));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const c = fixture.componentInstance;
    expect(c.nodes().length).toBe(3);
    expect(c.positioned().length).toBe(3);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('User 1');
    expect(text).toContain('User 2');
    expect(text).toContain('User 3');
  });

  it('computes layers correctly for a 3-node reporting chain', async () => {
    // u1 → u2 → u3 means u1 reports to u2, u2 reports to u3.
    // u3 is the top (layer 0), u2 layer 1, u1 layer 2.
    configure(buildGraph(3, [[1, 2], [2, 3]]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const positioned = fixture.componentInstance.positioned();
    const byId = new Map(positioned.map(p => [p.id, p]));
    expect(byId.get('u3')?.layer).toBe(0);
    expect(byId.get('u2')?.layer).toBe(1);
    expect(byId.get('u1')?.layer).toBe(2);

    // Each layer should have a strictly increasing y-coordinate.
    expect(byId.get('u2')!.y).toBeGreaterThan(byId.get('u3')!.y);
    expect(byId.get('u1')!.y).toBeGreaterThan(byId.get('u2')!.y);
  });

  it('isRelated returns true for direct neighbours when a node is hovered', async () => {
    configure(buildGraph(3, [[1, 2], [2, 3]]));
    fixture.detectChanges();
    await fixture.whenStable();

    const c = fixture.componentInstance;
    c.hoveredNode.set('u2');

    // hover target itself
    expect(c.isRelated('u2')).toBe(true);
    // direct supervisor
    expect(c.isRelated('u3')).toBe(true);
    // direct subordinate
    expect(c.isRelated('u1')).toBe(true);
  });

  it('isRelated returns true for ALL nodes when nothing is hovered', async () => {
    configure(buildGraph(3, [[1, 2], [2, 3]]));
    fixture.detectChanges();
    await fixture.whenStable();

    const c = fixture.componentInstance;
    c.hoveredNode.set(null);
    expect(c.isRelated('u1')).toBe(true);
    expect(c.isRelated('u3')).toBe(true);
  });

  it('places isolated nodes in a dedicated bottom group (layer -1)', async () => {
    // u1 → u2 reporting chain, plus u3 unrelated.
    configure(buildGraph(3, [[1, 2]]));
    fixture.detectChanges();
    await fixture.whenStable();

    const positioned = fixture.componentInstance.positioned();
    const u3 = positioned.find(p => p.id === 'u3');
    expect(u3?.layer).toBe(-1);
    // The isolated group sits BELOW the layered nodes.
    const layered = positioned.filter(p => p.layer >= 0);
    const maxLayeredY = Math.max(...layered.map(p => p.y));
    expect(u3!.y).toBeGreaterThan(maxLayeredY);
  });

  it('retries auto-fit after loading finishes so the real canvas can be measured', async () => {
    configure(buildGraph(3, [[1, 2], [2, 3]]));
    const attemptFitSpy = vi.spyOn(
      OrgChartComponent.prototype as unknown as { attemptFit: () => void },
      'attemptFit',
    );
    attemptFitSpy.mockImplementation(() => undefined);

    fixture.detectChanges();
    await fixture.whenStable();

    // First call happens while loading=true (spinner branch, no canvas yet).
    // We want a second call after loading=false so the actual canvas exists.
    expect(attemptFitSpy).toHaveBeenCalledTimes(2);
  });

  it('re-fits after toggling fullscreen', async () => {
    vi.useFakeTimers();
    configure(buildGraph(3, [[1, 2], [2, 3]]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const c = fixture.componentInstance;
    const attemptFitSpy = vi.spyOn(
      OrgChartComponent.prototype as unknown as { attemptFit: () => void },
      'attemptFit',
    );

    c.toggleFullscreen();
    vi.runAllTimers();

    expect(c.fullscreen()).toBe(true);
    expect(attemptFitSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('caps canvas height to the visible viewport, not the full page flow', async () => {
    configure(buildGraph(3, [[1, 2], [2, 3]]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const c = fixture.componentInstance;
    const canvas = c.canvasRef()?.nativeElement as HTMLDivElement | undefined;
    expect(canvas).toBeTruthy();
    if (!canvas) return;

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      top: 300,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(document.defaultView, 'innerHeight', {
      value: 900,
      configurable: true,
    });

    (c as unknown as { updateCanvasHeight: () => void }).updateCanvasHeight();

    expect(c.canvasHeightPx()).toBe(576);
  });
});
