/**
 * Wires Sentry into the backend at boot, OPT-IN by env var.
 *
 *   SENTRY_DSN=https://...   (required to activate)
 *   SENTRY_ENVIRONMENT=prod  (optional, default: NODE_ENV)
 *   SENTRY_TRACES_SAMPLE_RATE=0.1  (optional, default: 0)
 *
 * Designed to never block the boot. If the `@sentry/nestjs` package
 * isn't installed yet, the call is silently skipped — we don't want
 * a missing optional dep to crash the API. To enable, run:
 *
 *   npm i @sentry/nestjs @sentry/profiling-node
 *
 * and set SENTRY_DSN.
 */
export async function bootstrapSentry(): Promise<void> {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;

  // Dynamic import: if the package is missing the catch keeps boot alive
  // and just logs a hint. No-op if no DSN is set either.
  try {
    const Sentry = (await import('@sentry/nestjs').catch(() => null)) as
      | { init: (opts: Record<string, unknown>) => void }
      | null;
    if (!Sentry) {
      // eslint-disable-next-line no-console
      console.warn(
        '[sentry] SENTRY_DSN is set but @sentry/nestjs is not installed. Run `npm i @sentry/nestjs` to activate.',
      );
      return;
    }

    Sentry.init({
      dsn,
      environment: process.env['SENTRY_ENVIRONMENT'] ?? process.env['NODE_ENV'] ?? 'development',
      release: process.env['SENTRY_RELEASE'] ?? `jitre-backend@${process.env['npm_package_version'] ?? 'dev'}`,
      tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0'),
      // Default integrations are fine; we let the Nest SDK auto-wire
      // its express handlers via @Sentry/nestjs's NestModule on init.
    });
    // eslint-disable-next-line no-console
    console.log('[sentry] backend reporter active');
  } catch (err) {
    // Same defensive philosophy: never crash boot for telemetry.
    // eslint-disable-next-line no-console
    console.warn('[sentry] init failed (non-fatal):', (err as Error).message);
  }
}
