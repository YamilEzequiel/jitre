import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, ToastVariant } from '../../core/toast/toast.service';

function ariaRole(variant: ToastVariant): string {
  return variant === 'error' ? 'alert' : 'status';
}

@Component({
  selector: 'jt-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      aria-live="polite"
      aria-atomic="false"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          data-testid="toast"
          [attr.role]="role(toast.variant)"
          class="flex items-start justify-between gap-3 rounded-xl px-4 py-3
                 border backdrop-blur-xl shadow-lg text-sm text-white"
          [class]="toastClass(toast.variant)"
        >
          <span class="flex items-start gap-2.5 min-w-0">
            <span
              [class]="'mt-1 h-1.5 w-1.5 rounded-full flex-none ' + dotClass(toast.variant)"
              aria-hidden="true"
            ></span>
            <span class="break-words">{{ toast.message }}</span>
          </span>
          <button
            data-testid="toast-dismiss"
            type="button"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss notification"
            class="ml-auto shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            &#x2715;
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  role(variant: ToastVariant): string {
    return ariaRole(variant);
  }

  toastClass(variant: ToastVariant): string {
    const map: Record<ToastVariant, string> = {
      success: 'bg-emerald-500/15 border-emerald-400/30 shadow-emerald-500/20',
      error: 'bg-rose-500/15 border-rose-400/30 shadow-rose-500/20',
      info: 'bg-indigo-500/15 border-indigo-400/30 shadow-indigo-500/20',
      warning: 'bg-amber-500/15 border-amber-400/30 shadow-amber-500/20',
    };
    return map[variant];
  }

  dotClass(variant: ToastVariant): string {
    const map: Record<ToastVariant, string> = {
      success: 'bg-emerald-400 animate-pulse',
      error: 'bg-rose-400 animate-pulse',
      info: 'bg-indigo-400 animate-pulse',
      warning: 'bg-amber-400 animate-pulse',
    };
    return map[variant];
  }
}
