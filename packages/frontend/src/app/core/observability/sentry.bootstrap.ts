/**
 * Frontend Sentry init, OPT-IN.
 *
 * Reads VITE_-style globals injected at runtime via a `<script>` block
 * in index.html. We don't ship a hard dependency on @sentry/angular —
 * if it's not installed, this is a no-op. To activate:
 *
 *   npm i @sentry/angular -w @jitre/frontend
 *
 * and set window.__SENTRY_DSN__ in index.html (or your deploy template):
 *
 *   <script>window.__SENTRY_DSN__='https://...';</script>
 *
 * No bundler magic, no env-var leaks at build time, works in any host.
 */
interface SentryGlobals {
  __SENTRY_DSN__?: string;
  __SENTRY_ENVIRONMENT__?: string;
  __SENTRY_RELEASE__?: string;
  __SENTRY_TRACES_SAMPLE_RATE__?: string | number;
}

export async function bootstrapSentry(): Promise<void> {
  const win = (typeof window !== 'undefined' ? window : null) as
    | (Window & SentryGlobals)
    | null;
  const dsn = win?.__SENTRY_DSN__;
  if (!dsn) return;

  try {
    const Sentry = (await import('@sentry/angular').catch(() => null)) as
      | { init: (opts: Record<string, unknown>) => void }
      | null;
    if (!Sentry) {
      // eslint-disable-next-line no-console
      console.warn(
        '[sentry] window.__SENTRY_DSN__ is set but @sentry/angular is not installed. Run `npm i @sentry/angular -w @jitre/frontend` to activate.',
      );
      return;
    }

    Sentry.init({
      dsn,
      environment: win?.__SENTRY_ENVIRONMENT__ ?? 'production',
      release: win?.__SENTRY_RELEASE__ ?? 'jitre-frontend',
      tracesSampleRate: Number(win?.__SENTRY_TRACES_SAMPLE_RATE__ ?? 0),
    });
    // eslint-disable-next-line no-console
    console.log('[sentry] frontend reporter active');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sentry] init failed (non-fatal):', (err as Error).message);
  }
}
