import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MultiSelectModule } from 'primeng/multiselect';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import {
  OrgGraph,
  OrgGraphApiService,
  OrgGraphEdge,
  OrgGraphNode,
} from '../../../stores/org-graph-api.service';
import { EmployeeApiService } from '../../../stores/employee-api.service';
import { AreaStore } from '../../../stores/area.store';

/** Stable hash → hue. Same one used in `EmployeesComponent` for visual parity. */
function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function visibleCanvasHeightPx(
  canvasTop: number,
  viewportHeight: number,
  minHeight = 448,
  bottomGap = 24,
): number {
  return Math.max(minHeight, Math.floor(viewportHeight - canvasTop - bottomGap));
}

/** Card geometry — extracted so layout + render math stays in sync. */
const CARD_W = 220;
const CARD_H = 100;
const GAP_X = 40;
const GAP_Y = 80;
const LAYER_TOP = 60;
/** Width of the isolated/unassigned grid before wrapping. */
const ISOLATED_PER_ROW = 6;

interface PositionedNode extends OrgGraphNode {
  x: number;
  y: number;
  /** -1 means "isolated / unassigned" group. */
  layer: number;
  /**
   * Area id joined from the employee directory (`users.areaId`). The org-graph
   * endpoint doesn't expose it directly in v1, so we client-side-merge via
   * `EmployeeApiService.list()`. NULL when the user has no area.
   */
  areaId: string | null;
}

interface GraphBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

@Component({
  selector: 'jt-org-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MultiSelectModule],
  host: { class: 'flex flex-1 min-h-0 flex-col gap-4' },
  template: `
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/70">
      <div class="flex items-center gap-3 text-xs">
        <span class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
          <i class="pi pi-sitemap text-violet-600" aria-hidden="true"></i>
          <span class="font-bold uppercase tracking-[0.18em] text-violet-700">Organigrama</span>
        </span>
        <span class="font-semibold text-slate-700">{{ nodeCount() }} empleado{{ nodeCount() === 1 ? '' : 's' }}</span>
        <span class="text-slate-300">·</span>
        <span class="font-semibold text-slate-700">{{ edgeCount() }} relacion{{ edgeCount() === 1 ? '' : 'es' }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-1">
        @if (areaFilterOptions().length > 0) {
          <p-multiselect
            [ngModel]="selectedAreas()"
            (ngModelChange)="selectedAreas.set($event)"
            [options]="areaFilterOptions()"
            optionLabel="label"
            optionValue="value"
            [filter]="false"
            display="chip"
            [showClear]="true"
            placeholder="Filtrar por área"
            appendTo="body"
            styleClass="min-w-[14rem] mr-1"
          />
        }
        <button type="button"
                (click)="reload()"
                [disabled]="loading()"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-60"
                aria-label="Recargar organigrama">
          <i class="pi pi-refresh text-[11px]" [class.pi-spin]="loading()" aria-hidden="true"></i>
          Recargar
        </button>
        <button type="button"
                (click)="zoomIn()"
                class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-300 hover:text-violet-700"
                aria-label="Acercar">
          <i class="pi pi-search-plus text-xs" aria-hidden="true"></i>
        </button>
        <button type="button"
                (click)="zoomOut()"
                class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-300 hover:text-violet-700"
                aria-label="Alejar">
          <i class="pi pi-search-minus text-xs" aria-hidden="true"></i>
        </button>
        <button type="button"
                (click)="resetView()"
                class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-300 hover:text-violet-700"
                aria-label="Restablecer vista">
          <i class="pi pi-refresh text-xs" aria-hidden="true"></i>
        </button>
        <button type="button"
                (click)="toggleFullscreen()"
                class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-300 hover:text-violet-700"
                [attr.aria-label]="fullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'">
          <i [class]="'pi text-xs ' + (fullscreen() ? 'pi-window-minimize' : 'pi-window-maximize')" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Canvas / states -->
    @if (loading() && nodes().length === 0) {
      <div class="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500">
        <i class="pi pi-spin pi-spinner mr-2" aria-hidden="true"></i>
        Cargando organigrama…
      </div>
    } @else if (nodes().length === 0) {
      <div class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <span class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <i class="pi pi-sitemap text-xl" aria-hidden="true"></i>
        </span>
        <p class="text-sm font-bold text-slate-700">Sin empleados todavía</p>
        <p class="mt-1 text-xs text-slate-500">Sumá personas al workspace y volvé acá.</p>
      </div>
    } @else {
      <div #canvas
           class="relative flex-1 min-h-[28rem] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm shadow-slate-200/70 select-none"
           [class.fixed]="fullscreen()"
           [class.inset-0]="fullscreen()"
           [class.z-50]="fullscreen()"
           [class.rounded-none]="fullscreen()"
           [style.height]="fullscreen() ? '100vh' : null"
           [style.minHeight.px]="fullscreen() ? null : canvasHeightPx()"
           [style.height.px]="fullscreen() ? null : canvasHeightPx()"
           (wheel)="onWheel($event)"
           (mousedown)="onCanvasMouseDown($event)"
           (mousemove)="onMouseMove($event)"
           (mouseup)="onMouseUp()"
           (mouseleave)="onMouseUp()">
        <svg width="100%"
             height="100%"
             style="cursor: grab"
             [attr.viewBox]="svgViewBox()"
             preserveAspectRatio="xMidYMid meet"
             [attr.aria-label]="'Organigrama con ' + nodeCount() + ' empleados'">
          <defs>
            <marker id="org-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#94a3b8" />
            </marker>
            <marker id="org-arr-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#8b5cf6" />
            </marker>
            <filter id="org-ds" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.08" />
            </filter>
            <clipPath id="org-avatar-clip">
              <circle cx="0" cy="0" r="18" />
            </clipPath>
          </defs>

          <g [attr.transform]="'translate(' + panX() + ',' + panY() + ') scale(' + zoom() + ')'">
            <!-- Area background bands — drawn first so they sit behind edges + nodes. -->
            @for (band of areaBands(); track band.areaId) {
              <rect [attr.x]="band.x - 12"
                    [attr.y]="band.y - 32"
                    [attr.width]="band.w + 24"
                    [attr.height]="band.h + 44"
                    rx="18"
                    [attr.fill]="band.color + '15'"
                    [attr.stroke]="band.color"
                    stroke-width="1.5"
                    stroke-dasharray="6,4"
                    opacity="0.3" />
              <text [attr.x]="band.x"
                    [attr.y]="band.y - 14"
                    font-size="11"
                    font-weight="700"
                    [attr.fill]="band.color"
                    opacity="0.85"
                    style="text-transform: uppercase; letter-spacing: 0.18em">
                {{ band.name }}
              </text>
            }

            <!-- Edges -->
            @for (e of edges(); track e.from + '->' + e.to) {
              @if (edgePath(e); as p) {
                <path [attr.d]="p"
                      fill="none"
                      [attr.stroke]="isEdgeHighlighted(e) ? '#8b5cf6' : '#94a3b8'"
                      [attr.stroke-width]="isEdgeHighlighted(e) ? 2.25 : 1.5"
                      [attr.marker-end]="isEdgeHighlighted(e) ? 'url(#org-arr-hi)' : 'url(#org-arr)'"
                      [attr.opacity]="edgeOpacity(e)"
                      class="transition-opacity duration-200" />
              }
            }

            <!-- Isolated group label -->
            @if (isolatedBounds(); as b) {
              <rect [attr.x]="b.x - 16"
                    [attr.y]="b.y - 32"
                    [attr.width]="b.w + 32"
                    [attr.height]="b.h + 48"
                    rx="18"
                    fill="#f8fafc"
                    stroke="#e2e8f0"
                    stroke-dasharray="6,4"
                    opacity="0.7" />
              <text [attr.x]="b.x"
                    [attr.y]="b.y - 12"
                    font-size="11"
                    font-weight="700"
                    fill="#64748b"
                    style="text-transform: uppercase; letter-spacing: 0.18em">
                Sin asignar
              </text>
            }

            <!-- Nodes -->
            @for (n of positioned(); track n.id) {
              <g [attr.opacity]="hoveredNode() ? (isRelated(n.id) ? 1 : 0.25) : 1"
                 class="transition-opacity duration-200 cursor-pointer"
                 (mouseenter)="hoveredNode.set(n.id)"
                 (mouseleave)="hoveredNode.set(null)"
                 (click)="onNodeClick(n.id, $event)">
                <!-- Background -->
                <rect [attr.x]="n.x"
                      [attr.y]="n.y"
                      [attr.width]="cardW"
                      [attr.height]="cardH"
                      rx="14"
                      fill="#ffffff"
                      [attr.stroke]="hoveredNode() === n.id ? '#8b5cf6' : '#e2e8f0'"
                      [attr.stroke-width]="hoveredNode() === n.id ? 2.5 : 1.5"
                      filter="url(#org-ds)" />

                <!-- Avatar -->
                @if (n.avatarUrl) {
                  <g [attr.transform]="'translate(' + (n.x + 24) + ',' + (n.y + 32) + ')'">
                    <circle cx="0" cy="0" r="18" [attr.fill]="avatarBg(n.id)" />
                    <image [attr.href]="n.avatarUrl"
                           x="-18" y="-18" width="36" height="36"
                           preserveAspectRatio="xMidYMid slice"
                           clip-path="url(#org-avatar-clip)" />
                    <circle cx="0" cy="0" r="18" fill="none" stroke="#ffffff" stroke-width="1.5" />
                  </g>
                } @else {
                  <g [attr.transform]="'translate(' + (n.x + 24) + ',' + (n.y + 32) + ')'">
                    <circle cx="0" cy="0" r="18" [attr.fill]="avatarBg(n.id)" />
                    <text x="0" y="4" text-anchor="middle"
                          font-size="11.5" font-weight="700"
                          [attr.fill]="avatarFg(n.id)">{{ initials(n.displayName) }}</text>
                  </g>
                }

                <!-- Name -->
                <text [attr.x]="n.x + 50"
                      [attr.y]="n.y + 28"
                      font-size="13"
                      font-weight="700"
                      fill="#1e293b">{{ truncate(n.displayName, 20) }}</text>

                <!-- Email -->
                <text [attr.x]="n.x + 50"
                      [attr.y]="n.y + 44"
                      font-size="10"
                      fill="#94a3b8">{{ truncate(n.email, 24) }}</text>

                <!-- Job title -->
                @if (n.jobTitle) {
                  <text [attr.x]="n.x + 50"
                        [attr.y]="n.y + 58"
                        font-size="10"
                        font-weight="600"
                        fill="#64748b">{{ truncate(n.jobTitle, 24) }}</text>
                }

                <!-- Role badge -->
                <g [attr.transform]="'translate(' + (n.x + cardW - 12) + ',' + (n.y + cardH - 12) + ')'">
                  <rect [attr.x]="-roleBadgeWidth(n.role)"
                        y="-18"
                        [attr.width]="roleBadgeWidth(n.role)"
                        height="18"
                        rx="9"
                        [attr.fill]="roleBg(n.role)" />
                  <text x="-8" y="-5"
                        text-anchor="end"
                        font-size="9.5"
                        font-weight="700"
                        [attr.fill]="roleFg(n.role)">
                    {{ roleIcon(n.role) }} {{ roleLabel(n.role) }}
                  </text>
                </g>
              </g>
            }
          </g>
        </svg>

        <!-- Zoom indicator -->
        <div class="absolute bottom-3 left-3 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-500 backdrop-blur">
          {{ (zoom() * 100).toFixed(0) }}%
        </div>
        @if (edges().length === 0) {
          <div class="absolute right-3 top-3 max-w-xs rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-800 backdrop-blur">
            <i class="pi pi-info-circle mr-1" aria-hidden="true"></i>
            Sin relaciones definidas. Editá un empleado y asignale a quién reporta.
          </div>
        }
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-1 text-[11px] text-slate-500">
        <div class="flex flex-wrap items-center gap-4">
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-violet-500"></span>
            Owner
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
            Admin
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-400"></span>
            Member
          </span>
          <span class="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" stroke="#94a3b8" stroke-width="1.5" />
            </svg>
            Reporta a
          </span>
        </div>
        <span>Rueda para zoom · Arrastrá el lienzo para mover · Hovereá un nodo para resaltar su línea de reporte</span>
      </div>
    }
  `,
})
export class OrgChartComponent implements OnInit, OnDestroy {
  private readonly api = inject(OrgGraphApiService);
  private readonly employeeApi = inject(EmployeeApiService);
  private readonly areaStore = inject(AreaStore);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly initials = initials;
  protected readonly cardW = CARD_W;
  protected readonly cardH = CARD_H;

  readonly loading = signal(false);
  readonly fullscreen = signal(false);
  readonly hoveredNode = signal<string | null>(null);

  /** Raw graph from the backend; the layout is derived. */
  readonly graph = signal<OrgGraph>({ nodes: [], edges: [] });

  /** Fired when the admin clicks a node — the parent uses this to switch
   *  to the directory tab and open the edit modal for that employee. */
  readonly nodeSelected = output<string>();

  /** Ref to the canvas wrapper so we can measure its real width/height
   *  when fitting the graph to view. */
  readonly canvasRef = viewChild<ElementRef<HTMLDivElement>>('canvas');

  /** Set to true after the first successful auto-fit so we don't keep
   *  fighting the user's manual zoom/pan on every reload. */
  private hasInitialFit = false;
  private resizeObserver: ResizeObserver | null = null;
  /** Once the user pans/zooms manually, stop auto-refitting on resize. */
  private userAdjustedView = false;
  /**
   * Side-loaded user → areaId map. The org-graph endpoint doesn't expose area
   * yet, so we resolve it via `EmployeeApiService.list()` and merge in the
   * positioned-node computation. The map is empty until the request returns,
   * which means nodes simply render without an area until then.
   */
  readonly userAreaIds = signal<Map<string, string | null>>(new Map());
  /** Areas selected in the toolbar multiselect (empty = no filter). */
  readonly selectedAreas = signal<string[]>([]);
  readonly canvasHeightPx = signal<number>(448);
  readonly canvasWidthPx = signal<number>(800);

  /** Filters the raw graph by the area selection. Edges between hidden nodes are also dropped. */
  readonly visibleGraph = computed<OrgGraph>(() => {
    const raw = this.graph();
    const selected = this.selectedAreas();
    if (selected.length === 0) return raw;
    const mapping = this.userAreaIds();
    const selectedSet = new Set(selected);
    const visibleIds = new Set(
      raw.nodes
        .filter((n) => selectedSet.has(mapping.get(n.id) ?? ''))
        .map((n) => n.id),
    );
    return {
      nodes: raw.nodes.filter((n) => visibleIds.has(n.id)),
      edges: raw.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to)),
    };
  });

  readonly nodes = computed(() => this.visibleGraph().nodes);
  readonly edges = computed(() => this.visibleGraph().edges);
  readonly nodeCount = computed(() => this.nodes().length);
  readonly edgeCount = computed(() => this.edges().length);

  /** `<p-multiselect>` options pulled from the shared area cache. */
  readonly areaFilterOptions = computed(() => {
    return this.areaStore.areas().map((a) => ({ label: a.name, value: a.id }));
  });

  // Pan + zoom kept as signals so child computed (e.g. edge highlighting) and
  // tests can observe them. mousedown/up/move all flow through these.
  readonly zoom = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  private isPanning = false;
  private panMoved = false;
  private lastMouse = { x: 0, y: 0 };

  /**
   * Adjacency map: subordinate → [supervisors], plus the reverse map. Drives
   * `isRelated` (1-hop) and the layered layout.
   */
  private readonly adjacency = computed(() => {
    const supervisorsOf = new Map<string, string[]>();
    const subordinatesOf = new Map<string, string[]>();
    for (const n of this.nodes()) {
      supervisorsOf.set(n.id, []);
      subordinatesOf.set(n.id, []);
    }
    for (const e of this.edges()) {
      if (supervisorsOf.has(e.from)) supervisorsOf.get(e.from)!.push(e.to);
      if (subordinatesOf.has(e.to)) subordinatesOf.get(e.to)!.push(e.from);
    }
    return { supervisorsOf, subordinatesOf };
  });

  /**
   * Layered (Sugiyama-style) layout. We treat supervisors as the "roots" at
   * the TOP. A node's layer is the longest path FROM any root TO it through
   * the subordinate-of relation:
   *
   *   layer(n) = 0 if no one supervises n (top of the org)
   *   layer(n) = 1 + max(layer(supervisor)) for every supervisor of n
   *
   * Cycles (the backend only prevents direct ones) are guarded with a visited
   * set so layout stays finite — multi-hop cycle members end up at layer 0.
   */
  readonly positioned = computed<PositionedNode[]>(() => {
    const { supervisorsOf, subordinatesOf } = this.adjacency();
    const ns = this.nodes();
    if (ns.length === 0) return [];

    const layerOf = new Map<string, number>();
    const compute = (id: string, stack: Set<string>): number => {
      const cached = layerOf.get(id);
      if (cached !== undefined) return cached;
      if (stack.has(id)) return 0;
      stack.add(id);
      const sups = supervisorsOf.get(id) ?? [];
      let layer = 0;
      if (sups.length > 0) {
        layer = 1 + Math.max(...sups.map(s => compute(s, stack)));
      }
      stack.delete(id);
      layerOf.set(id, layer);
      return layer;
    };

    const isolated: OrgGraphNode[] = [];
    const layered = new Map<number, OrgGraphNode[]>();
    for (const n of ns) {
      const hasEdges =
        (supervisorsOf.get(n.id)?.length ?? 0) > 0 ||
        (subordinatesOf.get(n.id)?.length ?? 0) > 0;
      if (!hasEdges) {
        isolated.push(n);
        continue;
      }
      const l = compute(n.id, new Set());
      if (!layered.has(l)) layered.set(l, []);
      layered.get(l)!.push(n);
    }

    const layerIndexes = Array.from(layered.keys()).sort((a, b) => a - b);
    const widestCount = Math.max(
      0,
      ...layerIndexes.map(i => layered.get(i)!.length),
    );
    const widestWidth = widestCount * CARD_W + Math.max(0, widestCount - 1) * GAP_X;

    const result: PositionedNode[] = [];
    let bottomY = LAYER_TOP;

    for (const layer of layerIndexes) {
      const row = layered.get(layer)!;
      // Stable ordering — sort by displayName so re-renders don't jitter.
      row.sort((a, b) => a.displayName.localeCompare(b.displayName));
      const rowWidth = row.length * CARD_W + Math.max(0, row.length - 1) * GAP_X;
      const offset = (widestWidth - rowWidth) / 2;
      const y = LAYER_TOP + layer * (CARD_H + GAP_Y);
      bottomY = Math.max(bottomY, y + CARD_H);
      row.forEach((n, i) => {
        result.push({
          ...n,
          x: offset + i * (CARD_W + GAP_X),
          y,
          layer,
          areaId: this.userAreaIds().get(n.id) ?? null,
        });
      });
    }

    // Isolated nodes go to a grid BELOW the layered graph (or at the top
    // when nothing is layered yet).
    if (isolated.length > 0) {
      isolated.sort((a, b) => a.displayName.localeCompare(b.displayName));
      const startY = layerIndexes.length > 0 ? bottomY + GAP_Y + 28 : LAYER_TOP;
      const rows = Math.ceil(isolated.length / ISOLATED_PER_ROW);
      const cols = Math.min(ISOLATED_PER_ROW, isolated.length);
      const rowWidth = cols * CARD_W + Math.max(0, cols - 1) * GAP_X;
      const offset = (Math.max(widestWidth, rowWidth) - rowWidth) / 2;
      isolated.forEach((n, i) => {
        const row = Math.floor(i / ISOLATED_PER_ROW);
        const col = i % ISOLATED_PER_ROW;
        result.push({
          ...n,
          x: offset + col * (CARD_W + GAP_X),
          y: startY + row * (CARD_H + GAP_Y),
          layer: -1,
          areaId: this.userAreaIds().get(n.id) ?? null,
        });
      });
    }
    return result;
  });

  /**
   * Bounding box per area, used to render the dashed "swimlane" rectangle
   * behind groups of nodes. Areas with zero visible nodes are skipped.
   * Clones the pattern from `service-map.component.ts` (Zafirus ticket-infra).
   */
  readonly areaBands = computed<
    { areaId: string; name: string; color: string; x: number; y: number; w: number; h: number }[]
  >(() => {
    const byArea = new Map<string, PositionedNode[]>();
    for (const n of this.positioned()) {
      if (!n.areaId) continue;
      const existing = byArea.get(n.areaId);
      if (existing) existing.push(n);
      else byArea.set(n.areaId, [n]);
    }
    const areas = this.areaStore.byId();
    const bands: {
      areaId: string;
      name: string;
      color: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }[] = [];
    for (const [areaId, ns] of byArea) {
      const area = areas[areaId];
      if (!area) continue;
      const minX = Math.min(...ns.map((n) => n.x));
      const minY = Math.min(...ns.map((n) => n.y));
      const maxX = Math.max(...ns.map((n) => n.x)) + CARD_W;
      const maxY = Math.max(...ns.map((n) => n.y)) + CARD_H;
      bands.push({
        areaId,
        name: area.name,
        color: area.color,
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
      });
    }
    return bands;
  });

  /** Bounds for the dashed "Sin asignar" backdrop, or null when none isolated. */
  readonly isolatedBounds = computed(() => {
    const iso = this.positioned().filter(p => p.layer === -1);
    if (iso.length === 0) return null;
    const minX = Math.min(...iso.map(n => n.x));
    const minY = Math.min(...iso.map(n => n.y));
    const maxX = Math.max(...iso.map(n => n.x)) + CARD_W;
    const maxY = Math.max(...iso.map(n => n.y)) + CARD_H;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  });

  readonly graphBounds = computed<GraphBounds | null>(() => {
    const nodes = this.positioned();
    if (nodes.length === 0) return null;

    let minX = Math.min(...nodes.map((n) => n.x));
    let minY = Math.min(...nodes.map((n) => n.y));
    let maxX = Math.max(...nodes.map((n) => n.x + CARD_W));
    let maxY = Math.max(...nodes.map((n) => n.y + CARD_H));

    for (const band of this.areaBands()) {
      minX = Math.min(minX, band.x - 12);
      minY = Math.min(minY, band.y - 32);
      maxX = Math.max(maxX, band.x - 12 + band.w + 24);
      maxY = Math.max(maxY, band.y - 32 + band.h + 44);
    }

    const isolated = this.isolatedBounds();
    if (isolated) {
      minX = Math.min(minX, isolated.x - 16);
      minY = Math.min(minY, isolated.y - 32);
      maxX = Math.max(maxX, isolated.x - 16 + isolated.w + 32);
      maxY = Math.max(maxY, isolated.y - 32 + isolated.h + 48);
    }

    const padding = 40;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  });

  readonly svgViewBox = computed(() => {
    const bounds = this.graphBounds();
    if (!bounds) return '0 0 100 100';

    let width = Math.max(1, bounds.maxX - bounds.minX);
    let height = Math.max(1, bounds.maxY - bounds.minY);
    let minX = bounds.minX;
    let minY = bounds.minY;

    const canvasW = Math.max(1, this.canvasWidthPx());
    const canvasH = Math.max(1, this.canvasHeightPx());
    const targetAspect = canvasW / canvasH;
    const graphAspect = width / height;

    if (graphAspect > targetAspect) {
      const fittedHeight = width / targetAspect;
      const extra = fittedHeight - height;
      minY -= extra / 2;
      height = fittedHeight;
    } else {
      const fittedWidth = height * targetAspect;
      const extra = fittedWidth - width;
      minX -= extra / 2;
      width = fittedWidth;
    }

    return `${minX} ${minY} ${width} ${height}`;
  });

  private readonly positionsById = computed(() => {
    const map = new Map<string, PositionedNode>();
    for (const n of this.positioned()) map.set(n.id, n);
    return map;
  });

  ngOnInit(): void {
    void this.reload();

    // ESC exits fullscreen — same UX as the service-map reference. Using
    // fromEvent + DestroyRef (NOT @HostListener) per project conventions.
    fromEvent<KeyboardEvent>(this.document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        if (event.key === 'Escape' && this.fullscreen()) {
          this.fullscreen.set(false);
        }
      });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  async reload(): Promise<void> {
    const workspaceId = this.auth.currentWorkspace()?.id;
    if (!workspaceId) {
      this.toast.error('No hay workspace activo');
      return;
    }
    this.loading.set(true);
    try {
      // Org-graph is the critical path; areas + employee mapping fill the
      // area bands. The latter two fail silently — the chart still renders.
      const [graph] = await Promise.all([
        this.api.getOrgGraph(workspaceId),
        this.loadAreaContext(workspaceId),
      ]);
      this.graph.set(graph);
      // Reset the fit-flag so the next graph triggers another auto-fit.
      this.hasInitialFit = false;
      this.userAdjustedView = false;
    } catch {
      this.toast.error('No pudimos cargar el organigrama');
    } finally {
      this.loading.set(false);
      // IMPORTANT: the canvas only exists in the non-loading branch. If we try
      // to fit while `loading=true`, `canvasRef()` is undefined and the graph
      // can remain at the default pan/zoom, clipping the lower nodes.
      // Re-schedule once loading flips false so the real canvas is measurable.
      requestAnimationFrame(() => this.attemptFit());
    }
  }

  /**
   * Loads the shared area cache + a user→areaId mapping joined from the
   * employee directory. The mapping lives in a local signal because the
   * org-graph API doesn't expose `areaId` per node in v1 — keeping the join
   * client-side is the smallest change that unblocks the visual grouping.
   */
  private async loadAreaContext(workspaceId: string): Promise<void> {
    await Promise.all([
      this.areaStore.load(workspaceId).catch(() => undefined),
      this.employeeApi
        .list()
        .then((employees) => {
          const map = new Map<string, string | null>();
          for (const e of employees) map.set(e.id, e.areaId ?? null);
          this.userAreaIds.set(map);
        })
        .catch(() => undefined),
    ]);
  }

  // ── Pan + zoom ──────────────────────────────────────────────────────────
  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    this.userAdjustedView = true;
    this.zoom.update(z => Math.min(3, Math.max(0.3, z * factor)));
  }

  onCanvasMouseDown(e: MouseEvent): void {
    this.isPanning = true;
    this.panMoved = false;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return;
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      this.panMoved = true;
      this.userAdjustedView = true;
    }
    this.lastMouse = { x: e.clientX, y: e.clientY };
    this.panX.update(v => v + dx);
    this.panY.update(v => v + dy);
  }

  onMouseUp(): void {
    this.isPanning = false;
  }

  /**
   * Fired by a click on a node `<g>`. Suppressed when the user was actually
   * panning the canvas (dragged > 1px since mousedown), so a drag-release
   * over a node doesn't accidentally open the edit modal.
   */
  onNodeClick(userId: string, event: MouseEvent): void {
    if (this.panMoved) return;
    event.stopPropagation();
    this.nodeSelected.emit(userId);
  }

  /**
   * Tries to fit the graph to view. If the canvas isn't measurable yet
   * (clientWidth/Height too small — typical when this is called before
   * the browser has painted the tab), schedules another rAF and retries
   * up to a few times. Also installs a `ResizeObserver` so we self-correct
   * once the real size is known. Idempotent once `hasInitialFit` flips.
   */
  private attemptFit(retries = 5): void {
    if (this.hasInitialFit) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      if (retries > 0) requestAnimationFrame(() => this.attemptFit(retries - 1));
      return;
    }

    // Install the resize observer once. It re-fits on the very first frame
    // the canvas reaches a measurable size — covers the case where the
    // tab becomes visible AFTER reload() ran.
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateCanvasHeight();
        if (!this.userAdjustedView) this.scheduleFitToView();
      });
      this.resizeObserver.observe(canvas);
    }

    if (canvas.clientWidth >= 40 && canvas.clientHeight >= 40) {
      this.updateCanvasHeight();
      this.scheduleFitToView();
    } else if (retries > 0) {
      requestAnimationFrame(() => this.attemptFit(retries - 1));
    }
  }

  private scheduleFitToView(): void {
    requestAnimationFrame(() => this.fitToView());
  }

  private updateCanvasHeight(): void {
    if (this.fullscreen()) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const viewportHeight = this.document.defaultView?.innerHeight ?? 0;
    if (viewportHeight <= 0) return;
    const top = canvas.getBoundingClientRect().top;
    this.canvasWidthPx.set(Math.max(1, canvas.clientWidth));
    this.canvasHeightPx.set(visibleCanvasHeightPx(top, viewportHeight));
  }

  /**
   * Compute the bounding box of all positioned nodes and adjust `zoom` + pan
   * so the entire graph fits inside the canvas with a comfortable margin.
   * Called via `attemptFit` (which handles timing) and `resetView`.
   */
  fitToView(): void {
    const nodes = this.positioned();
    if (nodes.length === 0) return;

    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    if (canvas.clientWidth < 40 || canvas.clientHeight < 40) return;
    this.canvasWidthPx.set(Math.max(1, canvas.clientWidth));
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);

    this.hasInitialFit = true;
  }

  zoomIn(): void {
    this.userAdjustedView = true;
    this.zoom.update(z => Math.min(3, z * 1.15));
  }

  zoomOut(): void {
    this.userAdjustedView = true;
    this.zoom.update(z => Math.max(0.3, z / 1.15));
  }

  resetView(): void {
    // Re-fit the graph to view instead of hardcoded pan/zoom values.
    // Reset the flag so fitToView actually runs.
    this.hasInitialFit = false;
    this.userAdjustedView = false;
    this.scheduleFitToView();
  }

  toggleFullscreen(): void {
    this.fullscreen.update(v => !v);
    this.hasInitialFit = false;
    this.userAdjustedView = false;
    requestAnimationFrame(() => this.attemptFit());
  }

  // ── Hover relationships ─────────────────────────────────────────────────
  isRelated(nodeId: string): boolean {
    const hover = this.hoveredNode();
    if (!hover) return true;
    if (hover === nodeId) return true;
    const { supervisorsOf, subordinatesOf } = this.adjacency();
    return (
      (supervisorsOf.get(hover)?.includes(nodeId) ?? false) ||
      (subordinatesOf.get(hover)?.includes(nodeId) ?? false)
    );
  }

  isEdgeHighlighted(e: OrgGraphEdge): boolean {
    const hover = this.hoveredNode();
    return !!hover && (hover === e.from || hover === e.to);
  }

  edgeOpacity(e: OrgGraphEdge): number {
    const hover = this.hoveredNode();
    if (!hover) return 0.55;
    return hover === e.from || hover === e.to ? 0.9 : 0.1;
  }

  // ── Edge path geometry ──────────────────────────────────────────────────
  /**
   * Draws an upward bezier from the subordinate (from) card's top edge to
   * the supervisor (to) card's bottom edge — gives smooth S-curves when
   * the two cards aren't vertically aligned.
   */
  edgePath(e: OrgGraphEdge): string | null {
    const from = this.positionsById().get(e.from);
    const to = this.positionsById().get(e.to);
    if (!from || !to) return null;
    const x1 = from.x + CARD_W / 2;
    const y1 = from.y; // top of from-card
    const x2 = to.x + CARD_W / 2;
    const y2 = to.y + CARD_H; // bottom of to-card
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }

  // ── Cosmetic helpers ────────────────────────────────────────────────────
  truncate(s: string | null | undefined, m: number): string {
    if (!s) return '';
    return s.length > m ? s.slice(0, m - 1) + '…' : s;
  }

  avatarBg(id: string): string {
    return `hsl(${hashHue(id)}, 70%, 60%)`;
  }

  avatarFg(_id: string): string {
    return '#ffffff';
  }

  roleLabel(role: OrgGraphNode['role']): string {
    return role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Member';
  }

  roleIcon(role: OrgGraphNode['role']): string {
    return role === 'owner' ? '👑' : role === 'admin' ? '⚡' : '👤';
  }

  roleBg(role: OrgGraphNode['role']): string {
    if (role === 'owner') return '#ede9fe';
    if (role === 'admin') return '#e0e7ff';
    return '#f1f5f9';
  }

  roleFg(role: OrgGraphNode['role']): string {
    if (role === 'owner') return '#6d28d9';
    if (role === 'admin') return '#4338ca';
    return '#475569';
  }

  /**
   * Width in pixels for the badge pill — narrower for "Admin" than for
   * "Member" because the rendered text differs. Includes the emoji prefix.
   */
  roleBadgeWidth(role: OrgGraphNode['role']): number {
    if (role === 'owner') return 74;
    if (role === 'admin') return 72;
    return 78;
  }
}
