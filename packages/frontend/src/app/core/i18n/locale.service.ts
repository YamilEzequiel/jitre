import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type SupportedLocale = 'es' | 'en';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['es', 'en'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'es';
const STORAGE_KEY = 'jt.locale';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly translate = inject(TranslateService);
  private readonly _current = signal<SupportedLocale>(this.read());

  readonly current = this._current.asReadonly();
  readonly available = computed(() => SUPPORTED_LOCALES);

  init(): void {
    this.translate.addLangs([...SUPPORTED_LOCALES]);
    this.translate.setFallbackLang(DEFAULT_LOCALE);
    this.use(this._current());
  }

  use(locale: SupportedLocale): void {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    this._current.set(locale);
    this.translate.use(locale);
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  }

  toggle(): void {
    this.use(this._current() === 'es' ? 'en' : 'es');
  }

  private read(): SupportedLocale {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
        return stored as SupportedLocale;
      }
    } catch {
      // Ignore storage failures.
    }
    return DEFAULT_LOCALE;
  }
}
