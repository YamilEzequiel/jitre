import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'jt-auth-light-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none absolute inset-0 overflow-hidden' },
  template: `
    <div class="absolute inset-0">
      <div class="absolute inset-0 bg-[#f6f8fc]" aria-hidden="true"></div>
      <div
        class="pointer-events-none absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-100/45 blur-3xl"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-32 -left-20 h-[24rem] w-[24rem] rounded-full bg-sky-100/40 blur-3xl"
        aria-hidden="true"
      ></div>
      <div class="auth-light-grid" aria-hidden="true"></div>
    </div>
  `,
  styles: [
    `
      :host {
        z-index: 0;
      }

      .auth-light-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse at 60% 40%, black 25%, transparent 80%);
        pointer-events: none;
      }
    `,
  ],
})
export class AuthLightBackdropComponent {}
