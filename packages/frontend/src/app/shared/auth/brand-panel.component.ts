import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
  hue: number;
}

const BRAND_HUES = [
  235, // indigo
  255, // violet
  275, // purple
  295, // fuchsia
  205, // blue
];

@Component({
  selector: 'jt-brand-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <aside
      #root
      class="brand-panel relative hidden h-full min-h-screen overflow-hidden bg-[#070a1a] px-10 py-10 text-white lg:flex lg:flex-col xl:px-12"
    >
      <canvas #canvas class="absolute inset-0 h-full w-full"></canvas>
      <div class="brand-glow brand-glow--top" aria-hidden="true"></div>
      <div class="brand-glow brand-glow--bottom" aria-hidden="true"></div>
      <div class="brand-grid" aria-hidden="true"></div>
      <div class="brand-vignette" aria-hidden="true"></div>

      <div class="relative z-10 flex items-center gap-2.5">
        <span class="brand-logo-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="brand-logo-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#6366f1" />
                <stop offset="60%" stop-color="#8b5cf6" />
                <stop offset="100%" stop-color="#d946ef" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#brand-logo-grad)" />
            <path
              d="M40 14 v26 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -10 -10 v-2 h8 v2 a4 4 0 0 0 4 4 h2 a4 4 0 0 0 4 -4 V14 z"
              fill="#ffffff"
            />
          </svg>
        </span>
        <span class="text-lg font-bold tracking-tight text-white">Jitre</span>
      </div>

      <div class="relative z-10 mt-5 max-w-xl space-y-7 xl:mt-6">
        <div
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md"
        >
          <span class="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          </span>
          <span class="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-300">
            One workspace &middot; Zero context switching
          </span>
        </div>

        <h1 class="text-[3.15rem] font-black leading-[1.03] tracking-[-0.065em] xl:text-[3.5rem]">
          <span class="block text-white">Plan, ship</span>
          <span
            class="mt-1 block bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
          >
            and measure.
          </span>
        </h1>

        <p class="max-w-md text-sm leading-relaxed text-slate-400">
          Proyectos, tableros, docs, chat, AI y time tracking en un workspace pensado para equipos que necesitan claridad, no otra herramienta m&aacute;s.
        </p>

        <div class="grid grid-cols-2 gap-3 pt-1">
          @for (feature of features; track feature.label) {
            <div
              class="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3.5 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.08]"
            >
              <div
                class="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/[0.07] text-indigo-300 transition-colors group-hover:bg-indigo-500/15 group-hover:text-indigo-200"
              >
                <span [class]="'pi text-xs ' + feature.icon" aria-hidden="true"></span>
              </div>
              <span class="text-xs font-semibold text-slate-300">{{ feature.label }}</span>
            </div>
          }
        </div>
      </div>

      <div
        class="relative z-10 mt-auto flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
      >
        <span class="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></span>
        <span>Made for teams that ship</span>
        <span class="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></span>
      </div>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .brand-panel {
        isolation: isolate;
      }

      canvas {
        display: block;
        pointer-events: none;
      }

      .brand-logo-mark {
        display: inline-flex;
        height: 2rem;
        width: 2rem;
        border-radius: 0.5rem;
        overflow: hidden;
        box-shadow: 0 10px 24px -10px rgba(99, 102, 241, 0.65);
      }

      .brand-logo-mark svg {
        height: 100%;
        width: 100%;
      }

      .brand-glow {
        position: absolute;
        border-radius: 9999px;
        filter: blur(80px);
        pointer-events: none;
        mix-blend-mode: screen;
      }

      .brand-glow--top {
        top: -20%;
        right: -10%;
        width: 50%;
        aspect-ratio: 1 / 1;
        background: radial-gradient(closest-side, rgba(99, 102, 241, 0.55), transparent 70%);
      }

      .brand-glow--bottom {
        bottom: -25%;
        left: -10%;
        width: 55%;
        aspect-ratio: 1 / 1;
        background: radial-gradient(closest-side, rgba(217, 70, 239, 0.35), transparent 70%);
      }

      .brand-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse at 50% 40%, black 25%, transparent 80%);
        pointer-events: none;
      }

      .brand-vignette {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse at top, rgba(7, 10, 26, 0) 0%, rgba(7, 10, 26, 0.45) 80%),
          linear-gradient(180deg, rgba(7, 10, 26, 0) 55%, rgba(7, 10, 26, 0.9) 100%);
        pointer-events: none;
      }
    `,
  ],
})
export class BrandPanelComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly features = [
    { label: 'Kanban boards', icon: 'pi-clone' },
    { label: 'Sprint focus', icon: 'pi-bolt' },
    { label: 'Tempo-style time', icon: 'pi-clock' },
    { label: 'Realtime docs', icon: 'pi-file' },
  ] as const;

  private rafId = 0;
  private ctx: CanvasRenderingContext2D | null = null;
  private stars: Star[] = [];
  private dpr = 1;
  private width = 0;
  private height = 0;
  private targetMx = 0.5;
  private targetMy = 0.5;
  private mx = 0.5;
  private my = 0.5;
  private targetSpeed = 1;
  private speed = 1;
  private lastTs = 0;
  private prefersReduced = false;
  private resizeObserver: ResizeObserver | null = null;

  private readonly onPointerMove = (e: PointerEvent): void => {
    const rect = this.root().nativeElement.getBoundingClientRect();
    this.targetMx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    this.targetMy = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    this.targetSpeed = 4;
  };

  private readonly onPointerEnter = (): void => {
    this.targetSpeed = 4;
  };

  private readonly onPointerLeave = (): void => {
    this.targetMx = 0.5;
    this.targetMy = 0.5;
    this.targetSpeed = 1;
  };

  ngAfterViewInit(): void {
    const host = this.root().nativeElement;
    const canvas = this.canvas().nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    this.prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    this.resize();
    this.seedStars(220);

    this.zone.runOutsideAngular(() => {
      host.addEventListener('pointermove', this.onPointerMove, { passive: true });
      host.addEventListener('pointerenter', this.onPointerEnter, { passive: true });
      host.addEventListener('pointerleave', this.onPointerLeave, { passive: true });

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);

      this.lastTs = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    });

    this.destroyRef.onDestroy(() => {
      host.removeEventListener('pointermove', this.onPointerMove);
      host.removeEventListener('pointerenter', this.onPointerEnter);
      host.removeEventListener('pointerleave', this.onPointerLeave);
      this.resizeObserver?.disconnect();
      cancelAnimationFrame(this.rafId);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
  }

  private resize(): void {
    const host = this.root().nativeElement;
    const canvas = this.canvas().nativeElement;
    const rect = host.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    canvas.width = Math.floor(this.width * this.dpr);
    canvas.height = Math.floor(this.height * this.dpr);
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private seedStars(count: number): void {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const z = Math.random() * 1 + 0.05;
      this.stars.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z,
        pz: z,
        hue: BRAND_HUES[(Math.random() * BRAND_HUES.length) | 0],
      });
    }
  }

  private readonly tick = (now: number): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    const dt = Math.min((now - this.lastTs) / 1000, 0.05);
    this.lastTs = now;

    this.mx += (this.targetMx - this.mx) * 0.07;
    this.my += (this.targetMy - this.my) * 0.07;
    this.speed += (this.targetSpeed - this.speed) * 0.05;

    const effectiveSpeed = this.prefersReduced ? 0.3 : this.speed;
    const w = this.width;
    const h = this.height;
    const cx = w * (0.35 + this.mx * 0.3);
    const cy = h * (0.35 + this.my * 0.3);
    const focal = Math.max(w, h) * 0.6;

    // Trail: paint translucent dark rect to fade previous frame.
    ctx.fillStyle = 'rgba(7, 10, 26, 0.22)';
    ctx.fillRect(0, 0, w, h);

    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter'; // additive on dark bg = glow

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.pz = s.z;
      s.z -= dt * 0.55 * effectiveSpeed;

      if (s.z < 0.02) {
        s.x = (Math.random() - 0.5) * 2;
        s.y = (Math.random() - 0.5) * 2;
        s.z = 1;
        s.pz = 1;
        s.hue = BRAND_HUES[(Math.random() * BRAND_HUES.length) | 0];
        continue;
      }

      const x = (s.x / s.z) * focal + cx;
      const y = (s.y / s.z) * focal + cy;
      const px = (s.x / s.pz) * focal + cx;
      const py = (s.y / s.pz) * focal + cy;

      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;

      const depth = 1 - s.z;
      const lineWidth = 0.6 + depth * 2.6;
      const alpha = 0.25 + depth * 0.7;

      ctx.strokeStyle = `hsla(${s.hue}, 90%, 70%, ${alpha.toFixed(3)})`;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';

    this.rafId = requestAnimationFrame(this.tick);
  };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
