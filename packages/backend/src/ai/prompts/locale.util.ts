import type { SettingsService } from '../../settings/settings.service';

/**
 * Best-effort human-readable name for a locale code, used inside system
 * prompts so the model knows which language to respond in. Keep the list
 * tight — anything missing falls back to the raw code, which still works
 * for any modern LLM ("respond in pt-BR" is understood fine).
 */
const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  es: 'Spanish',
  'es-AR': 'Rioplatense Spanish (Argentina), using voseo',
  'es-ES': 'Spanish (Spain)',
  'es-MX': 'Spanish (Mexico)',
  'es-419': 'Latin American Spanish',
  pt: 'Portuguese',
  'pt-BR': 'Brazilian Portuguese',
  'pt-PT': 'European Portuguese',
  fr: 'French',
  it: 'Italian',
  de: 'German',
  ja: 'Japanese',
  zh: 'Chinese',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
};

export function localeName(code: string | undefined | null): string {
  if (!code) return LOCALE_NAMES.en;
  return LOCALE_NAMES[code] ?? code;
}

/**
 * Resolve the locale to use for an AI call. Precedence:
 *   1. `user.locale` if the user has explicitly set one different from default
 *   2. `workspace.default_locale`
 *   3. `'en'` as final fallback
 *
 * The user's preference wins because somebody who set their account to
 * `es-AR` wants AI output in es-AR even if the workspace default is `en`.
 */
export async function resolveAiLocale(
  settings: SettingsService,
  userId: string,
  workspaceId: string,
): Promise<string> {
  const [userLocale, workspaceLocale] = await Promise.all([
    settings
      .getUserSetting<string>(userId, 'user.locale')
      .catch(() => 'en'),
    settings
      .getWorkspaceSetting<string>(workspaceId, 'workspace.default_locale')
      .catch(() => 'en'),
  ]);
  if (userLocale && userLocale !== 'en') return userLocale;
  if (workspaceLocale && workspaceLocale !== 'en') return workspaceLocale;
  return userLocale || workspaceLocale || 'en';
}

/**
 * Produce the language directive that gets appended to a system prompt.
 * Returns an empty string for `en` so existing prompts don't add noise
 * when no translation is needed.
 */
export function languageDirective(locale: string): string {
  const code = locale ?? 'en';
  if (code === 'en' || code === 'en-US') return '';
  return ` Respond in ${localeName(code)} (locale code: ${code}). All natural-language text in your output MUST be in that language — keep code identifiers, file paths and JSON keys unchanged.`;
}
